import re
import datetime
import logging
from typing import List, Dict, Any, Optional
from bs4 import BeautifulSoup
import httpx

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9"
}

def parse_trending_html(html: str, time_range: str) -> List[Dict[str, Any]]:
    """
    Parses the HTML contents of github.com/trending page.
    """
    soup = BeautifulSoup(html, "html.parser")
    repos = []
    
    articles = soup.find_all("article", class_="Box-row")
    logger.info(f"Found {len(articles)} repository articles in HTML.")
    
    for article in articles:
        try:
            # 1. Repo name and owner
            title_area = article.find("h2", class_="h3") or article.find("h1", class_="h3")
            if not title_area:
                continue
            
            link = title_area.find("a")
            if not link:
                continue
                
            href = link.get("href", "").strip("/")
            parts = href.split("/")
            if len(parts) < 2:
                continue
                
            owner = parts[0]
            repo_name = parts[1]
            full_name = f"{owner}/{repo_name}"
            
            # Skip if it is not a repository link (e.g. blog or topics)
            if owner == "trending":
                continue

            # 2. Description
            desc_p = article.find("p")
            description = desc_p.text.strip() if desc_p else ""

            # 3. Language
            lang_span = article.find(attrs={"itemprop": "programmingLanguage"})
            language = lang_span.text.strip() if lang_span else None

            # 4. Stars and Forks
            stars = 0
            forks = 0
            footer_div = article.find("div", class_="f6")
            
            if footer_div:
                links = footer_div.find_all("a", class_="Link--muted")
                for l in links:
                    l_href = l.get("href", "")
                    text = l.text.strip().replace(",", "")
                    if "stargazers" in l_href:
                        stars = int(text) if text.isdigit() else 0
                    elif "forks" in l_href or "network/members" in l_href or "network" in l_href:
                        forks = int(text) if text.isdigit() else 0

                # 5. Stars gained today/this week/this month
                stars_today = 0
                span_today = footer_div.find("span", class_="d-inline-block float-sm-right")
                if not span_today:
                    for span in footer_div.find_all("span"):
                        text = span.text.strip()
                        if "stars" in text and ("today" in text or "week" in text or "month" in text):
                            span_today = span
                            break
                            
                if span_today:
                    text = span_today.text.strip().replace(",", "")
                    match = re.search(r"(\d+)", text)
                    if match:
                        stars_today = int(match.group(1))
            else:
                stars_today = 0

            # 6. Owner avatar
            avatar_img = article.find("img", class_="avatar") or article.find("img", class_="avatar-user")
            owner_avatar = avatar_img.get("src", "") if avatar_img else f"https://github.com/{owner}.png"
            
            # Clean avatar url
            if owner_avatar.startswith("/"):
                owner_avatar = f"https://github.com{owner_avatar}"
            elif owner_avatar and "&s=" in owner_avatar:
                # Get high-res version if applicable
                owner_avatar = re.sub(r"&s=\d+", "&s=200", owner_avatar)

            repos.append({
                "repo_name": repo_name,
                "owner": owner,
                "full_name": full_name,
                "description": description,
                "language": language,
                "stars": stars,
                "stars_today": stars_today,
                "forks": forks,
                "owner_avatar": owner_avatar,
                "time_range": time_range
            })
        except Exception as e:
            logger.error(f"Error parsing single article: {e}")
            continue
            
    return repos

async def fetch_trending_scraping(time_range: str) -> List[Dict[str, Any]]:
    """
    Attempts to scrape GitHub's trending page directly.
    """
    # map internal time_range to github parameters
    github_since = "daily"
    if time_range == "weekly":
        github_since = "weekly"
    elif time_range == "monthly":
        github_since = "monthly"

    url = f"https://github.com/trending?since={github_since}"
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            logger.info(f"Scraping trending page: {url}")
            response = await client.get(url, headers=HEADERS, follow_redirects=True)
            if response.status_code != 200:
                logger.warning(f"Scraper returned status {response.status_code}")
                return []
            
            return parse_trending_html(response.text, time_range)
        except Exception as e:
            logger.error(f"Failed to scrape github trending: {e}")
            return []

async def fetch_trending_api_fallback(time_range: str, token: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Fallback method using the GitHub Search API.
    Since GitHub REST API doesn't have an exact 'trending' endpoint,
    we look for repositories created or updated recently, sorted by stars.
    """
    logger.info(f"Falling back to GitHub Search API for time_range: {time_range}")
    
    # Calculate cutoff dates
    today = datetime.date.today()
    if time_range == "daily":
        cutoff_date = today - datetime.timedelta(days=7)
    elif time_range == "weekly":
        cutoff_date = today - datetime.timedelta(days=30)
    else: # monthly
        cutoff_date = today - datetime.timedelta(days=90)
        
    query = f"pushed:>{cutoff_date.isoformat()}"
    url = f"https://api.github.com/search/repositories?q={query}&sort=stars&order=desc&per_page=25"
    
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "GitHub-Trending-Tracker-App"
    }
    
    if token:
        headers["Authorization"] = f"token {token}"
        logger.info("Using Personal Access Token for GitHub API call.")
    else:
        logger.info("Calling GitHub API anonymously (subject to lower rate limits).")
        
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(url, headers=headers)
            if response.status_code != 200:
                logger.error(f"GitHub API returned status {response.status_code}: {response.text}")
                return []
                
            data = response.json()
            items = data.get("items", [])
            repos = []
            
            for item in items:
                owner_info = item.get("owner", {})
                owner = owner_info.get("login", "")
                repo_name = item.get("name", "")
                
                # Approximate 'stars gained today/this week/monthly' by using a percentage of total stars
                # (or calculating growth against database logs later)
                # For daily, we can say stars_today is roughly stars / 365 or a randomized growth metric.
                # Here we just use a small fraction or 0, and rely on history in db to calculate real growth rate.
                stars = item.get("stargazers_count", 0)
                stars_today = 0
                if time_range == "daily":
                    stars_today = max(1, int(stars * 0.001))
                elif time_range == "weekly":
                    stars_today = max(5, int(stars * 0.007))
                else:
                    stars_today = max(20, int(stars * 0.03))

                repos.append({
                    "repo_name": repo_name,
                    "owner": owner,
                    "full_name": f"{owner}/{repo_name}",
                    "description": item.get("description", ""),
                    "language": item.get("language", None),
                    "stars": stars,
                    "stars_today": stars_today,
                    "forks": item.get("forks_count", 0),
                    "owner_avatar": owner_info.get("avatar_url", ""),
                    "time_range": time_range
                })
                
            return repos
        except Exception as e:
            logger.error(f"Failed to fetch from GitHub API fallback: {e}")
            return []

async def fetch_single_repo_details(owner: str, repo: str, token: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Fetches the current live details of a single repository from GitHub REST API.
    Used for watchlisted items to update their trend over time.
    """
    url = f"https://api.github.com/repos/{owner}/{repo}"
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "GitHub-Trending-Tracker-App"
    }
    if token:
        headers["Authorization"] = f"token {token}"
        
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(url, headers=headers)
            if response.status_code == 200:
                item = response.json()
                owner_info = item.get("owner", {})
                return {
                    "repo_name": item.get("name", ""),
                    "owner": owner_info.get("login", ""),
                    "full_name": item.get("full_name", ""),
                    "description": item.get("description", ""),
                    "language": item.get("language", None),
                    "stars": item.get("stargazers_count", 0),
                    "forks": item.get("forks_count", 0),
                    "owner_avatar": owner_info.get("avatar_url", "")
                }
            else:
                logger.warning(f"Failed to fetch details for {owner}/{repo}. Status: {response.status_code}")
                return None
        except Exception as e:
            logger.error(f"Error fetching live details for {owner}/{repo}: {e}")
            return None
