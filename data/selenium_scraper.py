"""
Selenium web automation for financial data extraction.
Uses Chrome in headless mode via webdriver-manager (auto-installs ChromeDriver).

Use cases:
- Scrape financial data from sites without public APIs
- Automate report downloads from broker/exchange portals
- Extract structured data from JavaScript-rendered pages

Note: Requires Google Chrome installed. ChromeDriver managed automatically via webdriver-manager.
"""
import time
import json
from typing import Optional, List, Dict


def get_selenium_driver(headless: bool = True):
    """
    Initialize a Selenium Chrome WebDriver.
    Uses webdriver-manager for automatic ChromeDriver management.

    Returns:
        selenium WebDriver instance, or None if Selenium/Chrome unavailable.
    """
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.chrome.service import Service
        from webdriver_manager.chrome import ChromeDriverManager

        options = Options()
        if headless:
            options.add_argument("--headless")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")
        options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        return driver
    except Exception:
        return None


def scrape_yahoo_finance_summary(ticker: str) -> Dict:
    """
    Scrape key statistics from Yahoo Finance quote page using Selenium.
    Handles JavaScript-rendered content that requests/BeautifulSoup misses.

    Returns:
        Dict with available fields: ticker, name, price, market_cap, pe_ratio,
        52w_high, 52w_low, volume, avg_volume
        Returns {"error": str, "ticker": ticker} if scraping fails.
    """
    driver = get_selenium_driver()
    if driver is None:
        return {"error": "Selenium unavailable", "ticker": ticker}

    try:
        driver.get(f"https://finance.yahoo.com/quote/{ticker}/")
        time.sleep(2)  # Wait for JS render

        result = {"ticker": ticker}

        # Extract current price
        try:
            from selenium.webdriver.common.by import By
            price_elements = driver.find_elements(By.CSS_SELECTOR, '[data-field="regularMarketPrice"]')
            if price_elements:
                result["price"] = price_elements[0].text
        except Exception:
            result["price"] = None

        # Extract company name
        try:
            from selenium.webdriver.common.by import By
            h1_elements = driver.find_elements(By.TAG_NAME, "h1")
            if h1_elements:
                result["name"] = h1_elements[0].text
        except Exception:
            result["name"] = None

        # Extract stats from statistics table
        try:
            from selenium.webdriver.common.by import By
            stats_container = driver.find_elements(By.CSS_SELECTOR, '[data-testid="qsp-statistics"]')
            if stats_container:
                rows = stats_container[0].find_elements(By.TAG_NAME, "tr")
                for row in rows:
                    cells = row.find_elements(By.TAG_NAME, "td")
                    if len(cells) >= 2:
                        label = cells[0].text.strip().lower()
                        value = cells[1].text.strip()
                        if "market cap" in label:
                            result["market_cap"] = value
                        elif "p/e ratio" in label or "pe ratio" in label:
                            result["pe_ratio"] = value
                        elif "52 week high" in label:
                            result["52w_high"] = value
                        elif "52 week low" in label:
                            result["52w_low"] = value
                        elif "volume" in label and "avg" not in label:
                            result["volume"] = value
                        elif "avg. volume" in label or "avg volume" in label:
                            result["avg_volume"] = value
        except Exception:
            pass

        return result

    except Exception as e:
        return {"error": str(e), "ticker": ticker}
    finally:
        driver.quit()


def scrape_market_movers(exchange: str = "nasdaq") -> List[Dict]:
    """
    Scrape top market movers (gainers/losers) from Yahoo Finance.
    Demonstrates automated data collection pipeline.

    Args:
        exchange: "nasdaq", "nyse", or "sp500"

    Returns:
        List of dicts: [{"ticker": str, "price": float, "change_pct": float, "volume": str}, ...]
        Returns [] if scraping fails.
    """
    url_map = {
        "nasdaq": "https://finance.yahoo.com/gainers",
        "nyse": "https://finance.yahoo.com/losers",
        "sp500": "https://finance.yahoo.com/most-active",
    }
    url = url_map.get(exchange, url_map["nasdaq"])

    driver = get_selenium_driver()
    if driver is None:
        return []

    try:
        driver.get(url)
        time.sleep(3)  # Wait for table to render

        from selenium.webdriver.common.by import By

        rows = driver.find_elements(By.CSS_SELECTOR, '[data-testid="table-container"] tr')
        movers = []

        for row in rows[1:]:  # Skip header row
            try:
                cells = row.find_elements(By.TAG_NAME, "td")
                if len(cells) < 4:
                    continue

                ticker = cells[0].text.strip()
                price_text = cells[2].text.strip().replace(",", "")
                change_pct_text = cells[4].text.strip().replace("%", "").replace("+", "")
                volume = cells[6].text.strip() if len(cells) > 6 else ""

                try:
                    price = float(price_text)
                except ValueError:
                    price = None

                try:
                    change_pct = float(change_pct_text)
                except ValueError:
                    change_pct = None

                if ticker:
                    movers.append({
                        "ticker": ticker,
                        "price": price,
                        "change_pct": change_pct,
                        "volume": volume,
                    })
            except Exception:
                continue

        return movers

    except Exception:
        return []
    finally:
        driver.quit()
