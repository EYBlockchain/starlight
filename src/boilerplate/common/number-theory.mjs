/* eslint no-bitwise: ["error", { "allow": ["^"] }] */
// This module mostly takes some useful functions from:
// https://github.com/rsandor/number-theory
// but converts them for BigInt (the original library is limited to <2**52)
// We are very grateful for the original work by rsandor
import config from 'config';
import pkg from 'general-number';
import poseidonConstants from './poseidon-constants.mjs';

const { BN128_PRIME_FIELD, BN128_GROUP_ORDER, BABYJUBJUB } = config;

const { generalise, GN } = pkg;
const one = BigInt(1);
const { JUBJUBE, JUBJUBC, JUBJUBD, JUBJUBA } = BABYJUBJUB;
const Fp = BN128_GROUP_ORDER; // the prime field used with the curve E(Fp)
const Fq = JUBJUBE / JUBJUBC;
const DOMAIN_KEM = BigInt(10);
const DOMAIN_DEM = BigInt(20);

function addMod(addMe, m) {
  return addMe.reduce((e, acc) => (((e + m) % m) + acc) % m, BigInt(0));
}

function mulMod(timesMe, m) {
  return timesMe.reduce((e, acc) => (((e + m) % m) * acc) % m, BigInt(1));
}

function powerMod(base, exponent, m) {
  if (m === BigInt(1)) return BigInt(0);
  let result = BigInt(1);
  let b = (base + m) % m; // add m in case it's negative: % gives the remainder, not the mod
  let e = exponent;
  while (e > BigInt(0)) {
    if (e % BigInt(2) === BigInt(1)) result = (result * b) % m;
    e >>= BigInt(1); // eslint-disable-line no-bitwise
    b = (b * b) % m;
  }
  return result;
}

// function for extended Euclidean Algorithm
// (used to find modular inverse.
function gcdExtended(a, b, _xy) {
  const xy = _xy;
  if (a === 0n) {
    xy[0] = 0n;
    xy[1] = 1n;
    return b;
  }
  const xy1 = [0n, 0n];
  const gcd = gcdExtended(b % a, a, xy1);

  // Update x and y using results of recursive call
  xy[0] = xy1[1] - (b / a) * xy1[0];
  xy[1] = xy1[0]; // eslint-disable-line prefer-destructuring

  return gcd;
}

// Function to find modulo inverse of b.
function modInverse(b, m = BN128_PRIME_FIELD) {
  const xy = [0n, 0n]; // used in extended GCD algorithm
  const g = gcdExtended(b, m, xy);
  if (g !== 1n) throw new Error('Numbers were not relatively prime');
  // m is added to handle negative x
  return ((xy[0] % m) + m) % m;
}

// Function to compute a/b mod m
function modDivide(a, b, m = BN128_PRIME_FIELD) {
  const aa = ((a % m) + m) % m; // check the numbers are mod m and not negative
  const bb = ((b % m) + m) % m; // do we really need this?
  const inv = modInverse(bb, m);
  return (((inv * aa) % m) + m) % m;
}

function jacobiSymbol(_a, _b) {
  if (typeof _a !== 'bigint')
    throw new Error(`first parameter ${_a} is not a Bigint`);
  if (typeof _b !== 'bigint')
    throw new Error(`second parameter ${_b} is not a Bigint`);
  let a = _a;
  let b = _b;
  if (b % BigInt(2) === BigInt(0)) return NaN;
  if (b < BigInt(0)) return NaN;

  // (a on b) is independent of equivalence class of a mod b
  if (a < BigInt(0)) a = (a % b) + b;

  // flips just tracks parity, so I xor terms with it and end up looking at the
  // low order bit
  let flips = 0;
  // TODO Refactor while loop
  // eslint-disable-next-line no-constant-condition
  while (true) {
    a %= b;
    // (0 on b) = 0
    if (a === BigInt(0)) return 0;
    // Calculation of (2 on b)
    while (a % BigInt(2) === BigInt(0)) {
      // b could be so large that b*b overflows
      flips ^= Number(
        ((b % BigInt(8)) * (b % BigInt(8)) - BigInt(1)) / BigInt(8),
      ); // eslint-disable-line no-bitwise
      a /= BigInt(2);
    }

    // (1 on b) = 1
    if (a === BigInt(1)) {
      // look at the low order bit of flips to extract parity of total flips
      return flips & 1 ? -1 : 1; // eslint-disable-line no-bitwise
    }

    // Now a and b are coprime and odd, so "QR" applies
    // By reducing modulo 4, I avoid the possibility that (a-1)*(b-1) overflows
    flips ^= Number(
      (((a % BigInt(4)) - BigInt(1)) * ((b % BigInt(4)) - BigInt(1))) /
        BigInt(4),
    ); // eslint-disable-line no-bitwise

    const temp = a;
    a = b;
    b = temp;
  }
}

function quadraticNonresidue(p) {
  const SAFELOOP = 100000;
  const q = SAFELOOP < p ? SAFELOOP : p;
  for (let x = BigInt(2); x < q; x++) {
    if (jacobiSymbol(x, p) === -1) return x;
  }
  return NaN;
}

function squareRootModPrime(n, p) {
  if (jacobiSymbol(n, p) === 0) return BigInt(0);

  if (jacobiSymbol(n, p) !== 1) return NaN;

  let Q = p - BigInt(1);
  let S = BigInt(0);
  while (Q % BigInt(2) === BigInt(0)) {
    Q /= BigInt(2);
    S++;
  }

  // Now p - 1 = Q 2^S and Q is odd.
  if (p % BigInt(4) === BigInt(3)) {
    return powerMod(n, (p + BigInt(1)) / BigInt(4), p);
  }
  // So S != 1 (since in that case, p equiv 3 mod 4
  const z = quadraticNonresidue(p);
  let c = powerMod(z, Q, p);
  let R = powerMod(n, (Q + BigInt(1)) / BigInt(2), p);
  let t = powerMod(n, Q, p);
  let M = S;
  // TODO Refactor while loop
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (((t % p) + p) % p === BigInt(1)) return R;

    // Find the smallest i (0 < i < M) such that t^{2^i} = 1
    let u = t;
    let i;
    for (i = BigInt(1); i < M; i++) {
      u = (((u * u) % p) + p) % p;
      if (u === BigInt(1)) break;
    }

    const minimumI = i;
    i++;

    // Set b = c^{2^{M-i-1}}
    let b = c;
    while (i < M) {
      b = (((b * b) % p) + p) % p;
      i++;
    }

    M = minimumI;
    R = (((R * b) % p) + p) % p;
    t = (((t * b * b) % p) + p) % p;
    c = (((b * b) % p) + p) % p;
  }
}

/*
    Elliptic Curve arithmetic
  */

function isOnCurve(p) {
  const { JUBJUBA: a, JUBJUBD: d } = BABYJUBJUB;
  const uu = (p[0] * p[0]) % Fp;
  const vv = (p[1] * p[1]) % Fp;
  const uuvv = (uu * vv) % Fp;
  return (a * uu + vv) % Fp === (one + d * uuvv) % Fp;
}

/**
Point addition on the babyjubjub curve
*/
function add(p, q) {
  const { JUBJUBA: a, JUBJUBD: d } = BABYJUBJUB;
  const u1 = p[0];
  const v1 = p[1];
  const u2 = q[0];
  const v2 = q[1];
  const uOut = modDivide(u1 * v2 + v1 * u2, one + d * u1 * u2 * v1 * v2, Fp);
  const vOut = modDivide(
    v1 * v2 - a * u1 * u2,
    one - d * u1 * u2 * v1 * v2,
    Fp,
  );
  if (!isOnCurve([uOut, vOut]))
    throw new Error('Addition point is not on the babyjubjub curve');
  return [uOut, vOut];
}

/**
Scalar multiplication on a babyjubjub curve
@param {String} scalar - scalar mod q (will wrap if greater than mod q, which is probably ok)
@param {Object} h - curve point in u,v coordinates
*/
function scalarMult(scalar, h, form = 'Edwards') {
  const { INFINITY } = BABYJUBJUB;
  const a = ((BigInt(scalar) % Fq) + Fq) % Fq; // just in case we get a value that's too big or negative
  const exponent = a.toString(2).split(''); // extract individual binary elements
  let doubledP = [...h]; // shallow copy h to prevent h being mutated by the algorithm
  let accumulatedP = INFINITY;
  for (let i = exponent.length - 1; i >= 0; i--) {
    const candidateP = add(accumulatedP, doubledP, form);
    accumulatedP = exponent[i] === '1' ? candidateP : accumulatedP;
    doubledP = add(doubledP, doubledP, form);
  }
  if (!isOnCurve(accumulatedP))
    throw new Error(
      'Scalar multiplication point is not on the babyjubjub curve',
    );
  return accumulatedP;
}

/**
Create a Starlight compressed public key from a point
This is a quick fix to allow EC compressed keys (usually 256 bits) to fit into a field
It should be called by a function which retries until this doesn't return null
@param {GeneralNumber} publicKey
@return {GeneralNumber} publicKeyPoint
*/
function decompressStarlightKey(publicKeyInt) {
  const publicKeyBits = publicKeyInt.binary.padStart(254, '0');
  const sign = publicKeyBits[0];
  const y = new GN(publicKeyBits.slice(1), 'binary');
  if (y.bigInt > Fp) throw new Error(`y cordinate ${y} is not a field element`);
  // 168700.x^2 + y^2 = 1 + 168696.x^2.y^2
  const y2 = mulMod([y.bigInt, y.bigInt], Fp);
  const x2 = modDivide(
    addMod([y2, BigInt(-1)], Fp),
    addMod([mulMod([JUBJUBD, y2], Fp), -JUBJUBA], Fp),
    Fp,
  );
  if (x2 === 0n && sign === '0') return BABYJUBJUB.INFINITY;
  let x = generalise(squareRootModPrime(x2, Fp));
  const xBits = x.binary.padStart(256, '0');
  if (xBits[255] !== sign) x = generalise(Fp - x.bigInt);
  if (!isOnCurve([x.bigInt, y.bigInt]))
    throw new Error('The computed point was not on the Babyjubjub curve');
  return [x, y];
}

/**
Create a Starlight compressed public key from a point
This is a quick fix to allow EC compressed keys (usually 256 bits) to fit into a field
It should be called by a function which retries until this doesn't return null
@param {GeneralNumber} publicKeyPoint
@return {GeneralNumber} publicKey
*/
function compressStarlightKey(publicKeyPoint) {
  const yBits = publicKeyPoint[1].binary;
  if (yBits.length >= 253) return null;
  const xBits = publicKeyPoint[0].binary;
  const sign = xBits[xBits.length - 1];
  const publicKey = new GN(sign + yBits.padStart(253, '0'), 'binary');
  if (publicKey.bigInt >= Fp) return null;
  return publicKey;
}

/**
Encrypt messages encrypted with KEM-DEM
@param {string[]} Plaintext - hex string[]
@param {string} SendersecretKey - hex string
@param {string[2]} RecieverPublicKey - hex string[]
@return {string[]} plainText - int string[]
*/
function encrypt(plaintext, secretKey, recieverPublicKey) {
  const encryptedMessages = [];
  const sharedSecret = scalarMult(secretKey, [
    BigInt(recieverPublicKey[0]),
    BigInt(recieverPublicKey[1]),
  ]);
  const key = poseidonHash([
    sharedSecret[0],
    sharedSecret[1],
    BigInt(DOMAIN_KEM),
  ]);
  plaintext.forEach((msg, index) => {
    const hash = poseidonHash([key.bigInt, BigInt(DOMAIN_DEM), BigInt(index)]);
    encryptedMessages[index] = addMod([BigInt(msg), hash.bigInt], Fp);
    while (encryptedMessages[index] < 0n) {
      encryptedMessages[index] += Fp;
    }
  });
  return encryptedMessages;
}

/**
Decrypt messages encrypted with KEM-DEM
@param {string[]} encryptedMessages - hex string[]
@param {string} secretKey - hex string
@param {string[2]} encPublicKey - hex string[]
@return {string[]} plainText - int string[]
*/
function decrypt(encryptedMessages, secretKey, encPublicKey) {
  const plainText = [];
  const sharedSecret = scalarMult(secretKey, [
    BigInt(encPublicKey[0]),
    BigInt(encPublicKey[1]),
  ]);
  const key = poseidonHash([
    sharedSecret[0],
    sharedSecret[1],
    BigInt(DOMAIN_KEM),
  ]);
  encryptedMessages.forEach((msg, index) => {
    const hash = poseidonHash([key.bigInt, BigInt(DOMAIN_DEM), BigInt(index)]);
    plainText[index] = addMod([BigInt(msg), -hash.bigInt], Fp);
    while (plainText[index] < 0n) {
      plainText[index] += Fp;
    }
  });
  return plainText;
}


/**
@param {string} secretKey - hex string
@param {string[2]} recipientPublicKey - hex string[]
@return {string} key - int string
*/
function sharedSecretKey(secretKey, recipientPublicKey) {
	const publickKeyPoint = decompressStarlightKey(recipientPublicKey);
	const sharedSecret = scalarMult(secretKey.hex(32), [
		BigInt(generalise(publickKeyPoint[0]).hex(32)),
		BigInt(generalise(publickKeyPoint[1]).hex(32)),
	]);
	const key = poseidonHash([
		sharedSecret[0],
		sharedSecret[1],
		BigInt(DOMAIN_KEM),
	]);

	let sharePublicKeyPoint = generalise(
		scalarMult(key.hex(32), config.BABYJUBJUB.GENERATOR)
	);

	let yBits = sharePublicKeyPoint[1].binary;
	if (yBits.length > 253) 
	{   
		yBits = yBits.slice(yBits.length - 253);
	}

	const xBits = sharePublicKeyPoint[0].binary;
	const sign = xBits[xBits.length - 1];

	let sharedPublicKey = new GN(sign + yBits.padStart(253, "0"), "binary");


	return [key, sharedPublicKey];
}

// Implements the Poseidon hash, drawing on the ZoKrates implementation
// roundsP values referred from circom library
// https://github.com/iden3/circomlibjs/blob/main/src/poseidon_opt.js

const { C, M, SNARK_SCALAR_FIELD: q } = poseidonConstants;

function ark(state, c, it) {
  const N = state.length;
  for (let i = 0; i < N; i++) {
    state[i] = addMod([state[i], c[it + i]], q);
  }
  return state;
}

function sbox(state, f, p, r) {
  const N = state.length;
  state[0] = powerMod(state[0], 5n, q);
  for (let i = 1; i < N; i++) {
    state[i] =
      r < f / 2 || r >= f / 2 + p ? powerMod(state[i], 5n, q) : state[i];
  }
  return state;
}

function mix(state, m) {
  const N = state.length;
  const out = new Array(N).fill(0n);
  for (let i = 0; i < N; i++) {
    let acc = 0n;
    for (let j = 0; j < N; j++) {
      acc = addMod([acc, mulMod([state[j], m[i][j]], q)], q);
    }
    out[i] = acc;
  }
  return out;
}

function poseidonHash(_inputs) {
  if (_inputs.length > 16) throw new Error('To many inputs to Poseidon hash');
  const inputs = _inputs;
  const N = inputs.length;
  const t = N + 1;
  const roundsP = [
    56,
    57,
    56,
    60,
    60,
    63,
    64,
    63,
    60,
    66,
    60,
    65,
    70,
    60,
    64,
    68,
  ];
  const f = 8;
  const p = roundsP[t - 2];
  const c = C[t - 2];
  const m = M[t - 2];

  let state = new Array(t).fill(0n);
  for (let i = 1; i < t; i++) {
    state[i] = inputs[i - 1];
  }
  for (let r = 0; r < f + p; r++) {
    state = ark(state, c, r * t);
    state = sbox(state, f, p, r);
    state = mix(state, m);
  }
  // console.log('MATRIX', m);
  return generalise(state[0]);
}

// These exports are not unused, but find-unused-exports linter will complain because they are not used
// within the common-files folder, hence the special disable line below.
/* ignore unused exports */
export {
  squareRootModPrime,
  addMod,
  mulMod,
  powerMod,
  scalarMult,
  compressStarlightKey,
  decompressStarlightKey,
  encrypt,
  decrypt,
  poseidonHash,
  sharedSecretKey,
};
