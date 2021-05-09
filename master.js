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
    constructor(score_of_previous_round, trees, cells, play_index, sun, day) {
        // inputs :
        this.play_index = play_index;
        this.score_of_previous_round = score_of_previous_round;
        this.cells = cells;
        this.trees = trees;
        this.sun = sun;

        // settings :
        /*
        this.seed_mul = 3;
        this.complete_mul = 1;
        this.grow_mul = [3, 4, 5];

        if(day > 15){
            this.seed_mul = 1;
            this.complete_mul = 1;
            this.grow_mul = [3, 4, 5];
        }
        if(day >= 22){
            this.seed_mul = 0;
            this.complete_mul = 20;
            this.grow_mul = [1, 3, 5];
        }

         */
        this.seed_mul = 1;
        this.complete_mul = 10;
        this.grow_mul = [1, 1, 1];

    }

    getNumberOfTrees() {
        const res = {
            total:0,
            seeds:0,
            size_1:0,
            size_2:0,
            size_3:0,
        };
        this.trees.forEach(tree => {
            if(tree.isMine){
                res.total++;
                switch (tree.size){
                    case 0:
                        res.seeds++;
                        break;
                    case 1:
                        res.size_1++;
                        break;
                    case 2:
                        res.size_2++;
                        break;
                    case 3:
                        res.size_3++;
                        break;
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


        // COMPLETE
        if(nbr_of_trees.size_3 > 0){
            if (this.sun >= 4){
                this.trees.forEach(tree => {
                    if (tree.size === 3 && tree.isMine && !tree.isDormant){
                        actions_score.push({
                            play_index: this.play_index,
                            score: this.score_of_previous_round + this.cells[tree.cellIndex].richness * this.complete_mul,
                            action: COMPLETE,
                            targetIndex: tree.cellIndex,
                            sourceIndex: -1,
                        });
                    }
                });
            }
        }


        // SEED
        if(nbr_of_trees.total - nbr_of_trees.seeds > 0){
            if (this.sun >= nbr_of_trees.seeds){
                this.trees.forEach(tree => {
                    if (tree.isMine && tree.size > 0 && !tree.isDormant){
                        this.cells[tree.cellIndex].neighbors.forEach(spot => {
                            if (spot !== -1 && this.cells[spot].richness > 0 && !this.isOccupied(spot)){
                                actions_score.push({
                                    play_index: this.play_index,
                                    score: this.score_of_previous_round + this.cells[spot].richness * this.seed_mul,
                                    action: SEED,
                                    sourceIndex: tree.cellIndex,
                                    targetIndex: spot,
                                });
                            }
                        });
                    }
                });
            }
        }


        // GROW
        if (this.sun >= 1){
            if (nbr_of_trees.total > nbr_of_trees.size_3){
                this.trees.forEach(tree => {
                    if (tree.size < 3 && tree.isMine && !tree.isDormant){
                        let needed_sun;
                        switch (tree.size){
                            case 0:
                                needed_sun = 1 + nbr_of_trees.size_1;
                                break;
                            case 1:
                                needed_sun = 3 + nbr_of_trees.size_2;
                                break;
                            case 2:
                                needed_sun = 7 + nbr_of_trees.size_3;
                                break;
                        }
                        if(this.sun >= needed_sun){
                            actions_score.push({
                                play_index: this.play_index,
                                score: this.score_of_previous_round + this.cells[tree.cellIndex].richness * this.grow_mul[tree.size],
                                action: GROW,
                                targetIndex: tree.cellIndex,
                                sourceIndex: -1,
                            });
                        }
                    }
                });
            }
        }


        //WAIT

        if (actions_score.length === 0){
            actions_score.push({
                play_index: this.play_index,
                score: this.score_of_previous_round,
                action: WAIT,
                sourceIndex: -1,
                targetIndex: -1,
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
        this.max_rec = 100;
        this.max_action_nbr = 0;
        this.randomly_choosed_action_nbr = 12;
    }


    castShadows(tree, trees, day){
        const pos_to_check = [];
        let next_pos = tree.cellIndex;
        for (let i = 0; i < 3; i++) {
            next_pos = this.cells[next_pos].neighbors[(day+3)%6];
            if(next_pos === -1){
                break;
            }
            pos_to_check.push(next_pos);
        }
        trees.forEach(k_tree =>{
            if(pos_to_check.includes(k_tree.cellIndex) && k_tree.size >= tree.size){
                return false;
            }
        });
        return true;
    }


    getNumberOfTreesForSun(trees, day, is_shadow_casted) {
        const res = {
            seeds:0,
            size_1:0,
            size_2:0,
            size_3:0,
        };
        trees.forEach(tree => {
            if(tree.isMine){
                if(!is_shadow_casted || this.castShadows(tree, trees, day)){
                    switch (tree.size) {
                        case 0:
                            res.seeds++;
                            break;
                        case 1:
                            res.size_1++;
                            break;
                        case 2:
                            res.size_2++;
                            break;
                        case 3:
                            res.size_3++;
                            break;
                    }
                }
            }
        });
        return res;
    }


    makeAnAction(action, trees, sun, day){
        trees.map(tree =>{
            tree.isDormant = false;
            return tree;
        });
        if(action.action === COMPLETE){
            for (let i = 0; i < trees.length; i++) {
                if (trees[i].cellIndex === action.targetIndex){
                    sun -= 4;
                    trees.splice(i, 1);
                    break;
                }
            }
        }else if(action.action === GROW){
            const nbr_of_trees = this.getNumberOfTreesForSun(trees, day, false);
            for (let i = 0; i < trees.length; i++) {
                if (trees[i].cellIndex === action.targetIndex){
                    switch (trees[i].size){
                        case 0:
                            sun -= 1 + nbr_of_trees.size_1;
                            break;
                        case 1:
                            sun -= 3 + nbr_of_trees.size_2;
                            break;
                        case 2:
                            sun -= 7 + nbr_of_trees.size_3;
                            break;
                    }
                    trees[i].size++;
                    break;
                }
            }
        }else if(action.action === SEED){
            const nbr_of_trees = this.getNumberOfTreesForSun(trees, day, false);
            sun -= nbr_of_trees.seeds;
            for (let i = 0; i < trees.length; i++) {
                if (trees[i].cellIndex === action.targetIndex){
                    trees[i].isDormant = true;
                    break;
                }
            }
            trees.push(new Tree(action.targetIndex, 0, true, false));
        }else if(action.action === WAIT){
            if(day < 23){
                const nbr_of_trees = this.getNumberOfTreesForSun(trees, day, true);
                sun += nbr_of_trees.size_1 + nbr_of_trees.size_2 * 2 + nbr_of_trees.size_3 * 3;
            }
            day++;
        }

        return {
            trees:trees,
            sun:sun,
            day:day,
        };
    }


    predict(){
        //console.error(`start predictions time : ${(new Date().getTime()) - timeChecker} ms`);


        // ---- START ----


        // Get all possible action to play next round
        const first_analyse = new RoundAnalyse(0, this.trees, this.cells, -1, this.mySun, this.day);
        const first_actions_layer = first_analyse.getActionsScore();

        let last_actions_layer = [];

        first_actions_layer.forEach(action=>{
            const action_made = this.makeAnAction(action, JSON.parse(JSON.stringify(this.trees)), this.mySun, this.day);
            action.trees = action_made.trees;
            action.sun = action_made.sun;
            action.day = action_made.day;
            action.act_list = [action.action]
            last_actions_layer.push(action);
        });



        // ---- LOOP ----

        // Get all possible action for all the previous action
        for (let i=1; i < this.max_rec;i++){
            let is_still_updating = false;
            //console.error(`new iter ${i}, time : ${(new Date().getTime()) - timeChecker} ms`);
            const new_actions_layer = [];
            last_actions_layer.forEach(action =>{
                if(action.day > 23){
                    new_actions_layer.push(action);
                }else{
                    is_still_updating = true;
                    const returned_actions = (new RoundAnalyse(action.score, action.trees, this.cells, action.play_index, action.sun, action.day)).getActionsScore();
                    returned_actions.map(val => {
                        val.trees = action.trees;
                        val.sun = action.sun;
                        val.day = action.day;
                        val.act_list = [...action.act_list];
                        val.act_list.push(val.action);
                        return val;
                    });
                    new_actions_layer.push(
                        ...returned_actions
                    );
                }
            });


            if(!is_still_updating){
                console.error(`stop at ${i}`)
                break;
            }

            if (last_actions_layer.length > this.max_action_nbr){

                // keep the best action for the next iter

                const best_action_by_type = {
                    'SEED': {
                        score: -1,
                        action: -1,
                    },
                    'GROW': {
                        score: -1,
                        action: -1,
                    },
                    'COMPLETE': {
                        score: -1,
                        action: -1,
                    },
                    'WAIT': {
                        score: -1,
                        action: -1,
                    },
                }

                new_actions_layer.forEach(action => {
                    if (best_action_by_type[action.action].score < action.score){
                        best_action_by_type[action.action].score = action.score;
                        best_action_by_type[action.action].action = action;
                    }
                });

                const sorted_actions_layer = [];

                for (const [key, value] of Object.entries(best_action_by_type)) {
                    if (value.action !== -1){
                        sorted_actions_layer.push(value.action);
                    }
                }

                for (let j = 0; j <  this.randomly_choosed_action_nbr; j++) {
                    sorted_actions_layer.push(new_actions_layer[getRandomInt(0, new_actions_layer.length)]);
                }

                last_actions_layer = [];
                sorted_actions_layer.forEach(action => {
                    if(action.day > 23){
                        last_actions_layer.push(action);
                    }else{
                        const action_made = this.makeAnAction(action, JSON.parse(JSON.stringify(action.trees)), action.sun, action.day);
                        action.trees = action_made.trees;
                        action.sun = action_made.sun;
                        action.day = action_made.day;
                        last_actions_layer.push(action);
                    }
                });
            }else{
                last_actions_layer = [];
                new_actions_layer.forEach(action => {
                    if(action.day > 23){
                        last_actions_layer.push(action);
                    }else {
                        const action_made = this.makeAnAction(action, JSON.parse(JSON.stringify(action.trees)), action.sun, action.day);
                        action.trees = action_made.trees;
                        action.sun = action_made.sun;
                        action.day = action_made.day;
                        last_actions_layer.push(action);
                    }
                });
            }
        }


        // ---- RESULT ----

        // Get the best action
        let to_print;
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
                to_print = action;
            }
        });
        console.error(last_actions_layer.length, first_actions_layer.length);
        //console.error(last_actions_layer);
        console.error('BEST ACTION : ');
        console.error(to_print);
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

    const total_time = (new Date().getTime()) - timeChecker;

    console.error(`Total time : ${total_time} ms`);

    let message;
    switch (getRandomInt(0, 12)){
        case 0:
            message = `${total_time} ms, am I slow ?`;
            break;
        case 1:
            if (game.day > 12){
                if (game.myScore > game.opponentScore){
                    message = `Haha I'm winning ! (for now at least)`;
                } else if (game.myScore < game.opponentScore){
                    message = `You better be prepared for my comeback`;
                } else if (game.myScore === game.opponentScore){
                    message = `:| it's boring when we have the same score`;
                }
            }else{
                if (game.myScore > game.opponentScore){
                    message = `pfiou, to easy`;
                } else if (game.myScore < game.opponentScore){
                    message = `Gnagnagna, let me catch you up, at least a little`;
                } else if (game.myScore === game.opponentScore){
                    message = `lalalalala, I am still waiting for the action`;
                }
            }
            break;
        case 2:
            message = `let's ${action.type}`;
            break;
        case 3:
            if(game.mySun > 10){
                message = `Wow, I'm pretty rich with all this sun`;
            }else{
                message = `What a rainy day, give me some sun pleeaaase`;
            }
            break;
        default:
            message = 'NONE';
    }
    if(message === 'NONE'){
        console.log(action.toString());
    }else{
        console.log(action.toString(), message);
    }
}