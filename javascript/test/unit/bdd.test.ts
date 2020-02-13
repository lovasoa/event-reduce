import * as assert from 'assert';
import {
    randomString, randomBoolean
} from 'async-test-util';
import {
    TruthTable,
    createBddFromTruthTable,
    NonRootNode,
    ResolverFunctions
} from '../../src/bdd';
import {
    InternalNode
} from '../../src/bdd/internal-node';
import {
    decimalToPaddedBinary,
    maxBinaryWithLength,
    binaryToDecimal
} from '../../src/logic-generator/binary-state';
import { LeafNode } from '../../src/bdd/leaf-node';
import { ensureCorrectBdd } from '../../src/bdd/ensure-correct-bdd';
import { booleanStringToBoolean } from '../../src/bdd/util';
import { findSimilarNode } from '../../src/bdd/find-similar-node';

describe('bdd.test.ts', () => {
    const UNKNOWN = 'unknown';
    function exampleTruthTable(
        stateLength: number = 3
    ): TruthTable {
        const ret: TruthTable = new Map();
        const maxBin = maxBinaryWithLength(stateLength);
        const maxDecimal = binaryToDecimal(maxBin);

        const end = maxDecimal;
        let start = 0;
        while (start <= end) {
            ret.set(
                decimalToPaddedBinary(start, stateLength),
                'val_' + randomString(2)
            );
            start++;
        }
        return ret;
    }
    function allEqualTable(
        stateLength: number = 3
    ): TruthTable {
        const table = exampleTruthTable(stateLength);
        const keys = Array.from(table.keys());
        keys.forEach(k => table.set(k, 'a'));
        return table;
    }
    function randomTable(
        stateLength: number = 3
    ): TruthTable {
        const table = exampleTruthTable(stateLength);
        const keys = Array.from(table.keys());
        keys.forEach(k => {
            // 'b' is more often then 'a'
            const val = (randomBoolean() && randomBoolean()) ? 'a' : 'b';
            table.set(k, val);
        });
        return table;
    }
    function randomUnknownTable(
        stateLength: number = 3
    ): TruthTable {
        const table = exampleTruthTable(stateLength);
        for (const [key, value] of table.entries()) {
            if (randomBoolean()) {
                table.set(key, UNKNOWN);
            }
        }
        return table;
    }


    function getResolverFunctions(size: number): ResolverFunctions {
        const resolvers: ResolverFunctions = {};
        new Array(size).fill(0).forEach((_x, index) => {
            const fn = (state: string) => booleanStringToBoolean((state as any)[index]);
            resolvers[index] = fn;
        });
        return resolvers;
    }

    describe('createBddFromTruthTable()', () => {
        it('should create a bdd', () => {
            const bdd = createBddFromTruthTable(
                exampleTruthTable()
            );
            assert.ok(bdd);
            ensureCorrectBdd(bdd);
        });
        it('should create a big bdd', () => {
            const bdd = createBddFromTruthTable(
                exampleTruthTable(5)
            );
            assert.ok(bdd);
            ensureCorrectBdd(bdd);
        });
    });

    describe('equalBranches()', () => {
        it('should be false', () => {
            const bdd = createBddFromTruthTable(
                exampleTruthTable()
            );
            const nodes = bdd.getNodesOfLevel(1);
            const first: InternalNode = nodes.values().next().value;
            const equal = first.branches.hasEqualBranches();
            assert.strictEqual(equal, false);
        });
        it('should be true', () => {
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            const nodes = bdd.getNodesOfLevel(1);
            const first: InternalNode = nodes.values().next().value;
            const equal = first.branches.hasEqualBranches();
            assert.ok(equal);
        });
    });

    describe('findSimilarNode()', () => {
        it('should be equal to equal node of other bdd', () => {
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            const nodes = bdd.getNodesOfLevel(1);
            const first: InternalNode = nodes.values().next().value;

            const bdd2 = createBddFromTruthTable(table);
            const nodes2 = bdd2.getNodesOfLevel(1);
            const first2: InternalNode = nodes2.values().next().value;

            const found = findSimilarNode(
                first,
                [first2]
            );
            assert.ok(found);
        });
        it('should not find itself', () => {
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            const nodes = bdd.getNodesOfLevel(1);
            const first: InternalNode = nodes.values().next().value;

            const found = findSimilarNode(
                first,
                [first]
            );
            assert.strictEqual(found, null);
        });

        it('should be not be equal to root node', () => {
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            const nodes = bdd.getNodesOfLevel(1);
            const first: InternalNode = nodes.values().next().value;

            const found = findSimilarNode(
                first,
                [bdd as any]
            );
            assert.strictEqual(found, null);
        });
    });
    describe('applyReductionRule()', () => {
        it('should remove itself', () => {
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            const nodes: NonRootNode[] = bdd.getNodesOfLevel(2);
            const first: InternalNode = nodes[0] as InternalNode;
            ensureCorrectBdd(bdd);
            first.applyReductionRule();
            ensureCorrectBdd(bdd);
            assert.ok(
                (bdd as any).branches.getBranch('0').branches.getBranch('0').isLeafNode()
            );
            const second: InternalNode = nodes[1] as InternalNode;
            second.applyReductionRule();
            assert.ok(
                (bdd as any).branches.getBranch('0').branches.getBranch('1').isLeafNode()
            );
            ensureCorrectBdd(bdd);
        });
        it('should work on deeper bdd itself', () => {
            const table = allEqualTable(4);
            const bdd = createBddFromTruthTable(table);
            const nodes: NonRootNode[] = bdd.getNodesOfLevel(2);
            const first: InternalNode = nodes[0] as InternalNode;
            ensureCorrectBdd(bdd);
            first.applyReductionRule();
            ensureCorrectBdd(bdd);
            assert.ok(
                (bdd as any)
                    .branches.getBranch('0')
                    .branches.getBranch('0')
                    .branches.getBranch('0').isLeafNode()
            );
        });
    });
    describe('applyEliminationRule()', () => {
        it('should remove the found one', () => {
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            let nodes: NonRootNode[] = bdd.getNodesOfLevel(1);
            const first: InternalNode = nodes[0] as InternalNode;
            first.applyEliminationRule();
            ensureCorrectBdd(bdd);
            assert.strictEqual(
                bdd.branches.getBranch('0').id,
                bdd.branches.getBranch('1').id
            );

            nodes = bdd.getNodesOfLevel(1);
            const second: InternalNode = nodes[0] as InternalNode;
            second.applyEliminationRule();
            ensureCorrectBdd(bdd);
        });
    });
    describe('minimize()', () => {
        it('should return a minimized version', () => {
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            bdd.minimize(false);
            assert.ok((bdd as any).branches.getBranch('0').isLeafNode());
            assert.ok((bdd as any).branches.getBranch('1').isLeafNode());
            ensureCorrectBdd(bdd);
        });
        it('should not crash on random table', () => {
            const table = exampleTruthTable();
            table.set('000', 'a');
            table.set('001', 'a');
            table.set('010', 'a');
            const bdd = createBddFromTruthTable(table);
            bdd.minimize();
            assert.ok((bdd as any).branches.getBranch('0').branches.getBranch('0').isLeafNode());
            ensureCorrectBdd(bdd);
        });
        it('should not crash on a really big table', () => {
            const depth = 12;
            const table = randomTable(depth);
            const bdd = createBddFromTruthTable(table);
            bdd.minimize();
            ensureCorrectBdd(bdd);
        });
        it('random table should not have two equal branches', () => {
            const depth = 9;
            const table = randomTable(depth);
            const bdd = createBddFromTruthTable(table);
            bdd.minimize();
            ensureCorrectBdd(bdd);
            const leafNodes: LeafNode[] = bdd.getNodesOfLevel(depth) as LeafNode[];
            leafNodes.forEach(leaf => {
                const parents = leaf.parents.getAll();
                parents.forEach(parent => {
                    assert.notStrictEqual(
                        (parent.branches.getBranch('0') as LeafNode).value,
                        (parent.branches.getBranch('1') as LeafNode).value
                    );
                });
            });
        });
    });
    describe('countNodes()', () => {
        it('should be smaller after minimize', () => {
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            const before = bdd.countNodes();
            bdd.minimize();
            const after = bdd.countNodes();
            assert.ok(before > after);
        });
    });
    describe('.removeIrrelevantLeafNodes()', () => {
        it('should remove an irrelevant nodes', () => {
            const table = exampleTruthTable(5);
            table.set('00001', UNKNOWN);
            table.set('00000', UNKNOWN);
            table.set('00101', UNKNOWN);
            const bdd = createBddFromTruthTable(table);
            bdd.removeIrrelevantLeafNodes(UNKNOWN);
            bdd.getLeafNodes().forEach(node => {
                assert.notStrictEqual(
                    UNKNOWN,
                    node.value
                );
            });
            const jsonString = JSON.stringify(bdd.toJSON(true));
            assert.ok(!jsonString.includes(UNKNOWN));
        });
        it('should work on a big table', () => {
            const table = randomUnknownTable(6);
            const bdd = createBddFromTruthTable(table);
            bdd.removeIrrelevantLeafNodes(UNKNOWN);
            bdd.getLeafNodes().forEach(node => {
                assert.notStrictEqual(
                    UNKNOWN,
                    node.value
                );
            });
            const jsonString = JSON.stringify(bdd.toJSON(true));
            assert.ok(!jsonString.includes(UNKNOWN));
        });
    });
    describe('.resolve()', () => {
        it('should have the same values as the truth table', () => {
            const size = 8;
            const table = exampleTruthTable(size);
            const bdd = createBddFromTruthTable(table);
            const resolvers: ResolverFunctions = getResolverFunctions(size);

            for (const [key, value] of table.entries()) {
                const bddValue = bdd.resolve(resolvers, key);
                assert.strictEqual(value, bddValue);
            }
        });
        it('should have the same values after minimize', () => {
            const size = 8;
            const table = exampleTruthTable(size);
            const bdd = createBddFromTruthTable(table);
            const resolvers: ResolverFunctions = getResolverFunctions(size);

            bdd.minimize();
            for (const [key, value] of table.entries()) {
                const bddValue = bdd.resolve(resolvers, key);
                assert.strictEqual(value, bddValue);
            }
        });
    });
});