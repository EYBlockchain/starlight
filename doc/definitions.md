# Definitions of terms used in the compiler

A `function` has the meaning that it does in most languages
A `assignment` is a particular kind of `statement`, which assigns an `expression` to a `variable`.  For example:
```
x = 5 + y
```
Here the `variable` is x and the `expression` is `5 + y`.

Expressions can be more complex and contain addition or subtraction operators (`addops`) and `terms`

```
expression = term (addop term)*
```
Terms can contain `factors` and multiplication or division operators (`mulops`).

```
term = factor (mulop factor)*
```
factors can be expressions (in parentheses):
```
factor = constant | variable | function | (expression)
```
Note the potentially recursive nature of this definition!
