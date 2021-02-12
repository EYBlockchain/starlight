import figlet from 'figlet';

// An ever growing list of outbursts at runtime:
export default () => {
  const words = [
    'zappify!',
    'zapp-it!',
    'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
    'zapp-a-dee-doo-dah!',
    'brrrrrrrrrrrrrrrrrrrrr',
    `mmmm makin' dat sweet sweet zapp...`,
    `zapp brannigan's underpants!!!`,
    'gimme a "z"...',
    'starligh... LOL JK!',
    'zauzagez!',
    'zo zo zo zcandalouz',
    'zapp that (all on the floor...)',
    'zhe zellz zea zhellz on ze zea zhore',
    'by the beard of zeus!!!',
    'zappificating...',
    'zapp: (noun) - zero-knowledge application',
  ];
  const rnd = Math.floor(Math.random() * words.length);
  console.log(figlet.textSync(words[rnd]));
};
