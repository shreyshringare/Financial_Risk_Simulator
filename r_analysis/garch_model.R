# garch_model.R
# GARCH(1,1) volatility estimation for financial time series.
# Usage: Rscript garch_model.R <csv_path> <output_path>
# Input CSV: single column "Close" with price data, no header needed beyond that.
# Output JSON: GARCH parameters and volatility forecast.

# Suppress package load messages
suppressPackageStartupMessages({
  if (!require("rugarch", quietly = TRUE)) {
    install.packages("rugarch", repos = "https://cloud.r-project.org", quiet = TRUE)
    library(rugarch)
  }
  if (!require("jsonlite", quietly = TRUE)) {
    install.packages("jsonlite", repos = "https://cloud.r-project.org", quiet = TRUE)
    library(jsonlite)
  }
})

args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 2) {
  stop("Usage: Rscript garch_model.R <csv_path> <output_path>")
}

csv_path <- args[1]
output_path <- args[2]

# Load data
prices <- read.csv(csv_path)$Close
log_returns <- diff(log(prices)) * 100  # percentage log returns

# Fit GARCH(1,1) with normal innovations
spec <- ugarchspec(
  variance.model = list(model = "sGARCH", garchOrder = c(1, 1)),
  mean.model = list(armaOrder = c(0, 0), include.mean = TRUE),
  distribution.model = "norm"
)

fit <- ugarchfit(spec = spec, data = log_returns, solver = "hybrid")

# Extract parameters
coefs <- coef(fit)
omega <- as.numeric(coefs["omega"])
alpha1 <- as.numeric(coefs["alpha1"])
beta1 <- as.numeric(coefs["beta1"])
mu <- as.numeric(coefs["mu"])

# Volatility persistence
persistence <- alpha1 + beta1

# Annualized unconditional volatility (sqrt(252) * sqrt(omega / (1 - alpha1 - beta1)) / 100)
unconditional_vol <- sqrt(omega / (1 - persistence)) * sqrt(252) / 100

# 1-day ahead forecast
forecast <- ugarchforecast(fit, n.ahead = 10)
sigma_forecast <- as.numeric(sigma(forecast))

result <- list(
  model = "GARCH(1,1)",
  parameters = list(
    mu = round(mu, 6),
    omega = round(omega, 8),
    alpha1 = round(alpha1, 6),
    beta1 = round(beta1, 6)
  ),
  persistence = round(persistence, 6),
  unconditional_vol_annualized = round(unconditional_vol, 6),
  volatility_forecast_10d = round(sigma_forecast * sqrt(252) / 100, 6),
  n_observations = length(log_returns),
  notes = paste0(
    "Persistence = alpha1 + beta1 = ", round(persistence, 4),
    ". Values near 1.0 indicate high volatility clustering (ARCH effect). ",
    "GBM assumes constant vol; GARCH captures time-varying volatility."
  )
)

write(toJSON(result, auto_unbox = TRUE, pretty = TRUE), output_path)
cat("GARCH model fitted successfully. Output written to:", output_path, "\n")
