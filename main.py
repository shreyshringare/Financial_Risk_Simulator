import yfinance as yf
import numpy as np
import matplotlib.pyplot as plt

def download_data(ticker, start="2020-01-01"):
    data = yf.download(ticker, start=start)
    return data['Close'][ticker]

def simulate_price_paths(prices, days=252, simulations=500):
    log_returns = np.log(prices / prices.shift(1)).dropna()
    mu, sigma = log_returns.mean(), log_returns.std()
    last_price = prices.iloc[-1]
    
    simulated_paths = np.zeros((simulations, days))
    
    for i in range(simulations):
        path = [last_price]
        for _ in range(1, days):
            next_price = path[-1] * np.exp((mu - 0.5 * sigma ** 2) + sigma * np.random.normal())
            path.append(next_price)
        simulated_paths[i] = np.array(path)
        
    return simulated_paths

def plot_simulations(simulated_paths):
    plt.figure(figsize=(10, 6))
    for i in range(len(simulated_paths)):
        plt.plot(simulated_paths[i], alpha=0.05, color='blue')
    plt.title("Monte Carlo Simulations of Future Prices")
    plt.xlabel("Days")
    plt.ylabel("Price")
    plt.grid()
    plt.show()

def calculate_var(simulated_paths, confidence=0.95):
    final_prices = simulated_paths[:, -1]
    returns = final_prices / simulated_paths[:, 0] - 1
    var = np.percentile(returns, (1 - confidence) * 100)
    cvar = returns[returns <= var].mean()
    return var, cvar

def main():
    ticker = input("Enter stock ticker (e.g., AAPL): ").upper()
    prices = download_data(ticker)
    simulated_paths = simulate_price_paths(prices)
    plot_simulations(simulated_paths)
    var, cvar = calculate_var(simulated_paths)
    print(f"95% Value at Risk (VaR): {var*100:.2f}%")
    print(f"95% Conditional Value at Risk (CVaR): {cvar*100:.2f}%")

if __name__ == "__main__":
    main()
