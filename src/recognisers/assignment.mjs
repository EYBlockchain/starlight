/**
Recognise an expression of the form
variable = expression
*/

function recogniseAssignment(line) {
  // find assignements - currently we're over-reliant on correct spacing
  if (line.includes(' = ')) {
    // it's an assignement
    const ln = line.slice(0, -1); // strip ; TODO make this more robust
    const [variable, expression] = ln.split('=').map(el => el.trim());
    return { variable, expression };
  }
  return false;
}

export default recogniseAssignment;
