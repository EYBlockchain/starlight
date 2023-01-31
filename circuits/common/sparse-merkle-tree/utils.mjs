import createKeccakHash from 'keccak';
import utils from '../merkle-tree/utils.mjs';

const defineProducts = fields =>
  fields.reduce(
    (acc, T) => ({
      // This order means first come first called
      [T.length]: T,
      ...acc,
    }),
    {},
  );

export const SumType = (types, failure) => {
  const products = defineProducts(types);

  return (...args) => {
    const len = String(args.length);
    if (products[len]) {
      return products[len](...args);
    }

    return failure(...args);
  };
};

export const curry = f => {
  return a => {
    return b => {
      return f(a, b);
    };
  };
};

export const mapTree = (f, tree) => {
  switch (tree.tag) {
    case 'branch':
      return {
        tag: 'branch',
        left: mapTree(f, tree.left),
        // eslint-disable-next-line no-unused-vars
        right: mapTree(f, tree.right),
      };
    case 'leaf':
      return {
        tag: 'leaf',
        val: f(tree.val),
      };
    default:
      return tree;
  }
};

export const reduceTree = (f, tree) => {
  switch (tree.tag) {
    case 'branch':
      return f(reduceTree(f, tree.left), reduceTree(f, tree.right));
    case 'leaf':
      return tree.val;
    default:
      return tree;
  }
};

// export const compose = (...functions) => args => functions.reduceRight((arg, fn) => fn(arg), args);
export const compose = f => g => x => f(g(x));
export const pipe = (...fns) => x => fns.reduce((v, f) => f(v), x);
export const blackbird = compose(compose)(compose);

export const keccak256Hash = item => {
  const preimage = utils.strip0x(item);
  const h = `0x${createKeccakHash('keccak256')
    .update(preimage, 'hex')
    .digest('hex')}`;
  return h;
};

export const keccakConcatHash = (v1, v2) => {
  const preimage1 = utils.strip0x(v1);
  const preimage2 = utils.strip0x(v2);
  const h = keccak256Hash(`${preimage1}${preimage2}`);
  return h;
};

export function strip0x(hex) {
  if (typeof hex === 'undefined') return '';
  if (typeof hex === 'string' && hex.indexOf('0x') === 0) {
    return hex.slice(2).toString();
  }
  return hex.toString();
}

export const toBinArray = gnHex => {
  return BigInt(gnHex.hex(32))
    .toString(2)
    .split('');
};