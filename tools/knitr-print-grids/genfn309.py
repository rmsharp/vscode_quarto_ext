#!/usr/bin/env python3
"""usage: genfn309.py <outdir>  -- the FUNCTION grid: the stm layout (front matter, a setup0 chunk defining x / df / fit, `# Top`, a stray fence, `## Between`, ONE
`{r, echo=FALSE}` chunk of a single whole statement, `## After`), for ~120 base-R calls. Truth from the heading oracle: P (Between hidden) or Q.
`label` is my design call BEFORE rendering: Y = a candidate for the text-call whitelist, N = must stay out."""
import json, os, sys
out = sys.argv[1]
os.makedirs(out, exist_ok=True)
PRE = ["```{r setup0, include=FALSE}", "x <- c(3, 1, 2, 5, 4)", "g <- factor(c('a','b','a','b','a'))", "df <- cars", "fit <- lm(dist ~ speed, data = cars)", "tab <- table(mtcars$cyl, mtcars$gear)", "```", ""]
rows = []


def add(id, truth, label, code):
    rows.append((id, truth, label, code))


Y = [
    "median(x)", "sd(x)", "var(x)", "min(x)", "max(x)", "range(x)", "sum(x)", "length(x)", "ncol(df)", "dim(df)", "colnames(df)", "rev(x)", "sort(x)", "order(x)",
    "which(x > 2)", "seq_len(3)", "seq(1, 10, 2)", "rep(1, 3)", 'paste("a", "b")', 'sprintf("%d", 3L)', "format(pi, digits = 3)", 'nchar("abc")', 'toupper("a")',
    'substr("abc", 1, 2)', "cumsum(x)", "diff(x)", "prod(x)", "choose(5, 2)", "factorial(4)", "sqrt(x)", "exp(1)", "log(10)", "abs(-1)", "floor(2.5)", "ceiling(2.1)",
    "is.na(x)", "anyNA(x)", "class(x)", "typeof(x)", "mode(x)", "is.numeric(x)", 'exists("x")', "identical(1, 1)", "all.equal(1, 1)", "nlevels(g)", "levels(g)",
    "cor.test(cars$speed, cars$dist)", "shapiro.test(x)", "chisq.test(tab)", "wilcox.test(x, mu = 3)", "pairwise.t.test(mtcars$mpg, mtcars$cyl)",
    "TukeyHSD(aov(mpg ~ factor(cyl), data = mtcars))", "aov(mpg ~ factor(cyl), data = mtcars)", "lm(dist ~ speed, data = cars)", "glm(am ~ wt, data = mtcars, family = binomial)",
    "predict(fit, newdata = data.frame(speed = 10))", "residuals(fit)[1:3]", "confint(fit)", "fivenum(x)", "IQR(x)", "cut(x, 2)", "tabulate(c(1, 2, 2))", "outer(1:2, 1:2)",
    "matrix(1:4, 2)", "data.frame(a = 1)", "list(a = 1)", "c(1, 2)", "1:3", "letters[1:3]", "nrow(df)", "colMeans(df)", "rowSums(matrix(1:4, 2))", "apply(matrix(1:4, 2), 1, sum)",
    "sapply(1:3, function(i) i * 2)", "lapply(1:2, function(i) i)", "vapply(1:3, function(i) i * 2, numeric(1))", "Reduce(`+`, 1:4)", "do.call(rbind, list(1:2, 3:4))",
    "as.numeric(\"3\")", "as.integer(3.7)", "as.character(1)", "unlist(list(1, 2))", "t(matrix(1:4, 2))", "crossprod(1:3)", "nchar(c('a', 'bb'))", "trimws(' a ')",
    "unique(g)", "duplicated(c(1, 1, 2))", "rank(x)", "quantile(x, 0.9)", "scale(x)[1:2]", "cor(df)", "cov(df)", "ecdf(x)", "density(x)", "table(g)", "prop.table(table(g))",
    "xtabs(~ cyl, data = mtcars)", "ftable(Titanic)", "Sys.Date() > as.Date('2000-01-01')", "nlevels(iris$Species)", "toString(1:3)", "rev(letters[1:3])",
    "head(letters, 3)", "tail(x, 2)", "with(df, mean(speed))", "subset(df, speed > 20)", "merge(data.frame(a = 1), data.frame(a = 1))", "stack(list(a = 1, b = 2))",
    "is.null(NULL)", "nrow(na.omit(airquality))", "summary(g)", "summary(fit)$r.squared", "str(x)", "print(x)", "sessionInfo()$R.version$major",
]
for i, c in enumerate(Y):
    add(f"y{i + 1:03d}", "P", "Y", c)
Nq = [  # look like candidates, print NOTHING
    ("q001", "plot(x)"), ("q002", "hist(x)"), ("q003", "barplot(x)"), ("q004", "boxplot(x)"), ("q005", "plot(x); lines(x)"), ("q006", "abline(h = 1)"),
    ("q007", "par(mfrow = c(1, 1))"), ("q008", "set.seed(1)"), ("q009", "library(stats)"), ("q010", "require(stats)"), ("q011", "suppressWarnings(library(stats))"),
    ("q012", "invisible(x)"), ("q013", "invisible(summary(x))"), ("q014", "rm(df)"), ("q015", "x[1] <- 2"), ("q016", "Sys.setenv(A = '1')"), ("q017", "Sys.sleep(0)"),
    ("q018", "options(digits = 3)"), ("q019", "write.csv(df, tempfile())"), ("q020", "saveRDS(df, tempfile())"), ("q021", 'cat("")'), ("q022", "NULL"),
    ("q023", "invisible(NULL)"), ("q024", "mtext('a')"), ("q025", "title('a')"), ("q026", "legend('topright', legend = 'a')"), ("q027", "plot(fit)"),
    ("q028", "qqnorm(x)"), ("q029", "pie(x)"), ("q030", "image(matrix(1:4, 2))"), ("q031", "knitr::kable(df)"), ("q032", "knitr::opts_chunk$set(fig.width = 5)"),
    ("q033", "message('x')"), ("q034", "warning('x')"), ("q035", "stopifnot(TRUE)"), ("q036", "Sys.setlocale('LC_COLLATE', 'C')"), ("q037", "dev.off()"),
    ("q038", "f <- function() 1"), ("q039", "y <- sapply(1:3, function(i) i)"), ("q040", "y <- table(g)"),
]
for id, c in Nq:
    add(id, "?", "N", c)

manifest, pred = [], {}
for id, truth, label, code in rows:
    lines = ["---", 'title: "s"', "---", "", *PRE, "# Top", "", "```", "", "## Between", "", "```{r, echo=FALSE}", code, "```", "", "## After", ""]
    name = f"f_{id}"
    open(os.path.join(out, name + ".qmd"), "w").write("\n".join(lines))
    manifest.append({"file": name + ".qmd", "engine": "r"})
    pred[name] = {"truth": truth, "label": label, "note": code}
json.dump(manifest, open(os.path.join(out, "manifest.json"), "w"))
json.dump(pred, open(os.path.join(out, "PRED.json"), "w"))
print(len(rows), "documents")
