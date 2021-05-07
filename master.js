
// utilities

function getRandomInt(min,max) {
    return Math.floor(Math.random() * (max-min))  + min;
}

function getRandomNumber(min,max) {
    return Math.random() * (max-min) + min
}


// Main classes

class Cell {
    constructor(index, richness, neighbors) {
        this.index = index
        this.richness = richness
        this.neighbors = neighbors
    }
}
class Tree {
    constructor(cellIndex, size, isMine, isDormant) {
        this.cellIndex = cellIndex
        this.size = size
        this.isMine = isMine
        this.isDormant = isDormant
    }
}


const WAIT = 'WAIT'
const SEED = 'SEED'
const GROW = 'GROW'
const COMPLETE = 'COMPLETE'
class Action {
    constructor(type, targetCellIdx, sourceCellIdx) {
        this.type = type
        this.targetCellIdx = targetCellIdx
        this.sourceCellIdx = sourceCellIdx
    }
    static parse(line) {
        const parts = line.split(' ')
        if (parts[0] === WAIT) {
            return new Action(WAIT)
        }
        if (parts[1] === SEED) {
            return new Action(SEED, parseInt(parts[2]), parseInt(parts[1]))
        }
        return new Action(parts[0], parseInt(parts[1]))
    }
    toString() {
        if (this.type === WAIT) {
            return WAIT
        }
        if (this.type === SEED) {
            return `${SEED} ${this.sourceCellIdx} ${this.targetCellIdx}`
        }
        return `${this.type} ${this.targetCellIdx}`
    }
}


class Game {
    constructor() {
        // inputs :
        this.round = 0;
        this.nutrients = 0;
        this.cells = [];
        this.possibleActions = [];
        this.trees = [];
        this.mySun = 0;
        this.myScore = 0;
        this.opponentsSun = 0;
        this.opponentScore = 0;
        this.opponentIsWaiting = 0;

        // vars :
        this.max_rec = 10;

    }

    getBestSeed() {
        const bestLoc = {
            index:-1,
            richness:-1,
            target: -1,
        }
        let is_good = true;

        this.trees.forEach(tree =>{
            if (tree.isMine){
                this.cells[tree.cellIndex].neighbors.forEach(spot =>{
                    if(spot !== -1 ){
                        if(this.cells[spot].richness > bestLoc.richness){
                            bestLoc.index = tree.cellIndex;
                            bestLoc.target = spot;
                            bestLoc.richness = this.cells[spot].richness;
                        }
                    }
                });
            }
        });

        if(bestLoc.index === -1){
            is_good = false;
        }

        return {
            is_good: is_good,
            cellIndex: bestLoc.index,
            targetIndex: bestLoc.target,
        };
    }

    getBestGrow() {
        const bestTree = {
            index:-1,
            richness:-1,
        }
        let is_good = true;

        this.trees.forEach(tree =>{
            if(tree.isMine && this.cells[tree.cellIndex].richness > bestTree.richness && tree.size < 3){
                bestTree.index = tree.cellIndex;
                bestTree.size = tree.size;
                bestTree.richness = this.cells[tree.cellIndex].richness;
            }
        });

        console.error(bestTree);

        if(bestTree.index === -1){
            is_good = false;
        }

        return {
            is_good: is_good,
            cellIndex: bestTree.index
        };
    }

    getBestComplete() {
        const bestTree = {
            index:-1,
            richness:-1,
        }
        let is_good = true;

        this.trees.forEach(tree =>{
            if(tree.isMine && this.cells[tree.cellIndex].richness > bestTree.richness){
                bestTree.index = tree.cellIndex;
                bestTree.size = tree.size;
                bestTree.richness = this.cells[tree.cellIndex].richness;
            }
        });

        console.error(bestTree);

        if(bestTree.index === -1){
            is_good = false;
        }

        return {
            is_good: is_good,
            cellIndex: bestTree.index
        };
    }


    chooseBestAction(){
        let res;

        switch (getRandomInt(0, 5)){
            case 0: case 3:
                res = COMPLETE;
                break;
            case 1: case 4:
                res = GROW;
                break;
            case 2:
                res = SEED;
                break;
        }

        return res;
    }

    getNextAction(rec_i = 0) {
        const res = {
            type:WAIT,
            sourceIndex:-1,
            targetIndex:-1,
        }
        let redo = false;

        switch (this.chooseBestAction()){
            case WAIT:
                break;
            case SEED:
                const bestSeed = this.getBestSeed();
                if(bestSeed.is_good){
                    res.type = SEED;
                    res.sourceIndex = bestSeed.cellIndex;
                    res.targetIndex = bestSeed.targetIndex;
                }else{
                    redo = true
                }
                break;
            case GROW:
                const bestGrow = this.getBestGrow();
                if(bestGrow.is_good){
                    res.type = GROW;
                    res.targetIndex = bestGrow.cellIndex;
                }else{
                    redo = true
                }
                break;
            case COMPLETE:
                const bestComplete = this.getBestComplete();
                if(bestComplete.is_good){
                    res.type = COMPLETE;
                    res.targetIndex = bestComplete.cellIndex;
                }else{
                    redo = true
                }
                break;
        }
        if(redo && rec_i < this.max_rec){
            return this.getNextAction(rec_i+1);
        }else{
            return new Action(res.type, res.targetIndex, res.sourceIndex);
        }
    }
}


const game = new Game()

const numberOfCells = parseInt(readline());
for (let i = 0; i < numberOfCells; i++) {
    const inputs = readline().split(' ');
    const index = parseInt(inputs[0]);
    const richness = parseInt(inputs[1]);
    const neigh0 = parseInt(inputs[2]);
    const neigh1 = parseInt(inputs[3]);
    const neigh2 = parseInt(inputs[4]);
    const neigh3 = parseInt(inputs[5]);
    const neigh4 = parseInt(inputs[6]);
    const neigh5 = parseInt(inputs[7]);
    game.cells.push(
        new Cell(index, richness, [neigh0, neigh1, neigh2, neigh3, neigh4, neigh5])
    )
}


while (true) {
    game.day = parseInt(readline());
    game.nutrients = parseInt(readline());
    let inputs = readline().split(' ');
    game.mySun = parseInt(inputs[0]);
    game.myScore = parseInt(inputs[1]);
    inputs = readline().split(' ');
    game.opponentSun = parseInt(inputs[0]);
    game.opponentScore = parseInt(inputs[1]);
    game.opponentIsWaiting = inputs[2] !== '0';
    game.trees = []
    const numberOfTrees = parseInt(readline());
    for (let i = 0; i < numberOfTrees; i++) {
        let inputs = readline().split(' ');
        const cellIndex = parseInt(inputs[0]);
        const size = parseInt(inputs[1]);
        const isMine = inputs[2] !== '0';
        const isDormant = inputs[3] !== '0';
        game.trees.push(
            new Tree(cellIndex, size, isMine, isDormant)
        )
    }
    game.possibleActions = []
    const numberOfPossibleAction = parseInt(readline());
    for (let i = 0; i < numberOfPossibleAction; i++) {
        const possibleAction = readline();
        game.possibleActions.push(Action.parse(possibleAction));
    }

    const action = game.getNextAction();
    console.log(action.toString());
}