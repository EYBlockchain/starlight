// @UNUSED?
/**
process an expression into terms and operators
 we assume for the moment that an expression is of the form:
 term addop term addop ....term
 and we won't worry about factors, parentheses and powers etc
 TODO worry about those things
*/

function processExpression(expression) {
  const expr = `+ ${expression}`.split(' '); // split string up on spaces adding a leading plus to make later processing easier
  const terms = [];
  for (let i = 1; i < expr.length; i += 2) {
    if (expr[i - 1] === '-') terms.push(expr[i] * -1);
    else terms.push(expr[i]);
  }
  return terms;
}

export default processExpression;
