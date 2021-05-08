let timeChecker = new Date().getTime();
// to log time -> console.error(`[BALISE] time : ${(new Date().getTime()) - timeChecker} ms`);


// TODO : manage sun count


// --- utilities ---

function getRandomInt(min,max) {
    return Math.floor(Math.random() * (max-min))  + min;
}

function getRandomNumber(min,max) {
    return Math.random() * (max-min) + min
}



// --- Main classes ---

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


// --- Prediction classes ---

class RoundAnalyse{
    constructor(score_of_previous_round, trees, cells, play_index) {
        // inputs :
        this.play_index = play_index;
        this.score_of_previous_round = score_of_previous_round;
        this.cells = cells;
        this.trees = trees;

        // settings :
        this.min_trees = 1;
    }

    getNumberOfTrees() {
        const res = {
            nbr_of_max_tree:0,
            nbr_of_trees:0,
        };
        this.trees.forEach(tree => {
            if(tree.isMine){
                res.nbr_of_trees++;
                if(tree.size === 3){
                    res.nbr_of_max_tree++;
                }
            }
        });
        return res;
    }


    isOccupied(spot) {
        for (let i = 0; i < this.trees.length; i++) {
            if(this.trees[i].cellIndex === spot){
                return true
            }
        }
        return false;
    }


    getActionsScore(){
        const actions_score = [];
        const nbr_of_trees = this.getNumberOfTrees();

        /*
        //WAIT

        actions_score.push({
            play_index: this.play_index,
            score:this.score_of_previous_round,
            action:WAIT,
            sourceIndex:-1,
            targetIndex: -1,
        });
        */


        if(nbr_of_trees.nbr_of_max_tree > 0){

            // COMPLETE

            if (nbr_of_trees.nbr_of_trees > this.min_trees){
                this.trees.forEach(tree =>{
                    if(tree.size === 3 && tree.isMine && !tree.isDormant){
                        actions_score.push({
                            play_index: this.play_index,
                            score: this.score_of_previous_round + this.cells[tree.cellIndex].richness,
                            action: COMPLETE,
                            targetIndex: tree.cellIndex,
                            sourceIndex: -1,
                        });
                    }
                });
            }


            // SEED

            this.trees.forEach(tree =>{
                if (tree.isMine && !tree.isDormant){
                    this.cells[tree.cellIndex].neighbors.forEach(spot =>{
                        if(spot !== -1 && this.cells[spot].richness > 0 && !this.isOccupied(spot)){
                            actions_score.push({
                                play_index: this.play_index,
                                score: this.score_of_previous_round + this.cells[tree.cellIndex].richness / 4,
                                action: SEED,
                                sourceIndex: tree.cellIndex,
                                targetIndex: spot,
                            });
                        }
                    });
                }
            });
        }


        // GROW

        if(nbr_of_trees.nbr_of_trees > nbr_of_trees.nbr_of_max_tree){
            this.trees.forEach(tree =>{
                if(tree.size < 3 && tree.isMine && !tree.isDormant){
                    actions_score.push({
                        play_index: this.play_index,
                        score: this.score_of_previous_round + this.cells[tree.cellIndex].richness / (4-tree.size),
                        action: GROW,
                        targetIndex: tree.cellIndex,
                        sourceIndex: -1,
                    });
                }
            });
        }

        if(this.play_index === -1){
            actions_score.map((val, i) => {
                val.play_index = i;
                return val;
            });
        }

        return actions_score;
    }
}



// --- Da game manager ---

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

        // settings :
        this.max_rec = 30;
        this.endings_days_start = 20;
        this.ending_max_rec = 3;
    }


    makeAnAction(trees, action){
        trees.map(tree =>{
            tree.isDormant = false;
            return tree;
        });
        if(action.action === COMPLETE){
            for (let i = 0; i < trees.length; i++) {
                if (trees[i].cellIndex === action.targetIndex){
                    trees.splice(i, 1);
                    break;
                }
            }
        }else if(action.action === GROW){
            for (let i = 0; i < trees.length; i++) {
                if (trees[i].cellIndex === action.targetIndex){
                    trees[i].size++;
                    break;
                }
            }
        }else if(action.action === SEED){
            for (let i = 0; i < trees.length; i++) {
                if (trees[i].cellIndex === action.targetIndex){
                    trees[i].isDormant = true;
                    break;
                }
            }
            trees.push(new Tree(action.targetIndex, 0, true, false));
        }
        return trees;
    }


    predict(){
        //console.error(`start predictions time : ${(new Date().getTime()) - timeChecker} ms`);

        if (this.round >= this.endings_days_start){
            this.max_rec = this.ending_max_rec;
        }

        // Get all possible action to play next round
        const first_analyse = new RoundAnalyse(0, this.trees, this.cells, -1);
        const first_actions_layer = first_analyse.getActionsScore();

        let last_actions_layer = [];

        first_actions_layer.forEach(action=>{
            action.trees = this.makeAnAction(JSON.parse(JSON.stringify(this.trees)), action);
            last_actions_layer.push(action);
        });


        // Get all possible action for all the previous action
        for (let i=1; i < this.max_rec;i++){
            //console.error(`new iter ${i}, time : ${(new Date().getTime()) - timeChecker} ms`);
            const new_actions_layer = [];
            last_actions_layer.forEach(action =>{
                const returned_actions = (new RoundAnalyse(action.score, action.trees, this.cells, action.play_index)).getActionsScore();
                returned_actions.map(val => {
                    val.trees = action.trees
                    return val;
                });
                new_actions_layer.push(
                    ...returned_actions
                );
            });


            // keep the best action for the next iter

            const best_action_by_type = {
                'SEED':{
                    score:-1,
                    action:-1,
                },
                'GROW':{
                    score:-1,
                    action:-1,
                },
                'COMPLETE':{
                    score:-1,
                    action:-1,
                },
            }

            new_actions_layer.forEach(action =>{
                if (best_action_by_type[action.action].score < action.score){
                    best_action_by_type[action.action].score = action.score;
                    best_action_by_type[action.action].action = action;
                }
            });

            const sorted_actions_layer = [];

            for(const [key, value] of Object.entries(best_action_by_type)){
                if(value.action !== -1){
                    sorted_actions_layer.push(value.action);
                }
            }

            last_actions_layer = [];
            sorted_actions_layer.forEach(action=>{
                action.trees = this.makeAnAction(JSON.parse(JSON.stringify(action.trees)), action);
                last_actions_layer.push(action);
            });
        }


        // Get the best action
        let best_action = {
            score:-1,
            action:WAIT,
            sourceIndex:-1,
            targetIndex: -1,
        }
        last_actions_layer.forEach(action => {
            if (action.score > best_action.score){
                best_action.score = action.score;
                best_action.action = first_actions_layer[action.play_index].action;
                best_action.sourceIndex = first_actions_layer[action.play_index].sourceIndex;
                best_action.targetIndex = first_actions_layer[action.play_index].targetIndex;
            }
        });

        console.error(best_action);

        return new Action(best_action.action, best_action.targetIndex, best_action.sourceIndex);
    }


    getNextAction() {
        return this.predict();
    }
}





// --- get and send data ---

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

    timeChecker = new Date().getTime();

    const action = game.getNextAction();

    console.error(`Total time : ${(new Date().getTime()) - timeChecker} ms`);

    console.log(action.toString());
}