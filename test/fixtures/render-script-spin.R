#' ---
#' title: "Spin Render Script"
#' format: html
#' ---

#' ## Summary
#'
#' A knitr *spin* script: prose lives in roxygen (`#'`) comments and the rest is
#' plain R. Quarto renders it with the **knitr** engine, so — unlike a Jupyter
#' percent script — it needs no Jupyter kernel. That makes it this suite's
#' accept-path fixture: a real, successful `quarto preview` round-trip.

summary(cars)

#' The speeds above come from R's built-in `cars` dataset.

nrow(cars)
