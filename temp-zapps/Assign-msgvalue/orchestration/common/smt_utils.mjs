import { poseidonHash } from "./number-theory.mjs";

const defineProducts = (fields) =>
	fields.reduce(
		(acc, T) => ({
			// This order means first come first called
			[T.length]: T,
			...acc,
		}),
		{}
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

export const curry = (f) => {
	return (a) => {
		return (b) => {
			return f(a, b);
		};
	};
};

export const mapTree = (f, tree) => {
	switch (tree.tag) {
		case "branch":
			return {
				tag: "branch",
				left: mapTree(f, tree.left),
				// eslint-disable-next-line no-unused-vars
				right: mapTree(f, tree.right),
			};
		case "leaf":
			return {
				tag: "leaf",
				val: f(tree.val),
			};
		default:
			return tree;
	}
};

export const reduceTree = (f, tree) => {
	switch (tree.tag) {
		case "branch":
			return f(reduceTree(f, tree.left), reduceTree(f, tree.right));
		case "leaf":
			return tree.val;
		default:
			return tree;
	}
};

export const toBinArray = (gnHex) => {
	return BigInt(gnHex.hex(32)).toString(2).split("");
};

export const poseidonConcatHash = (v1, v2) => {
	const h = poseidonHash([BigInt(v1), BigInt(v2)])._hex;
	return h;
};
