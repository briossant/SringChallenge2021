let timeChecker = new Date().getTime();
let rounds_played = 0;
// to log time -> console.error(`[BALISE] time : ${(new Date().getTime()) - timeChecker} ms`);



// last rank : 540 gold



// --- utilities ---

function getRandomInt(min,max) {
    return Math.floor(Math.random() * (max-min))  + min;
}

function getRandomNumber(min,max) {
    return Math.random() * (max-min) + min;
}





// --- Main classes ---

function newCell (index, richness, neighbors){
    // array : [index, richness, neighbors x 6, sun_potential]
    return [index, richness, ...neighbors, 1];
}
function newTree (index, size, isMine, isDormant) {
    // array : [index, size, isMine, isDormant]
    return [index, size, isMine, isDormant];
}


const WAIT = 'WAIT';
const SEED = 'SEED';
const GROW = 'GROW';
const COMPLETE = 'COMPLETE';
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


// [play_index, score, action, target, source, trees, cells, sun, day]


// --- Zi analyser ---

class RoundAnalyse {
    constructor(action, iter, nutrients) {
        // inputs :
        this.last_action = action;
        this.play_index = action[0];
        this.score_of_previous_round = action[1];
        this.cells = action[6];
        this.trees = action[5];
        this.sun = action[7];
        this.day = (action[8]+1) / 24;
        this.rday = action[8];
        this.iter = iter;
        this.nutrients = nutrients;

        this.cellI = 9;
        this.treeI = 4;

        // settings :

        this.max_tree = 5;

        this.mulA = 0.6;
        this.mulB = 0.8;
        this.mulC = 1;

        this.seed_mul = 15;
        this.start_seed_mul = 1;
        this.seed_2_phase_day = 7;

        this.change_commplete = false;
        this.complete_mul = 1.1 * (-3*Math.pow(this.day, 2) + 4.5 * this.day -1.3);
        this.grow_mul = [5, 10, 15];
        this.wait_mul = 10/(this.rday+1);
        if(this.rday > 17){
            this.complete_mul *= 3;
        }
        if(this.nutrients < 5){
            this.change_commplete = true;
        }
    }


    getNumberOfTrees() {
        const res = [0,0,0,0,0]
        for (let i = 0; i < this.trees.length; i += this.treeI) {
            if(this.trees[i+2]){
                res[4]++;
                res[this.trees[i+1]]++;
            }
        }
        return res;
    }


    isOccupied(spot) {
        for (let i = 0; i < this.trees.length; i += this.treeI) {
            if(this.trees[i] === spot){
                return true
            }
        }
        return false;
    }

    // [play_index, score, action, target, source, trees, cells, sun, day]
    getActionsScore() {
        const actions_score = [];
        const nbr_of_trees = this.getNumberOfTrees();


        // COMPLETE
        if(nbr_of_trees[3] > 0 && this.sun >= 4){
            if(this.play_index === -1){
                for (let i = 0; i < this.trees.length; i += this.treeI) {
                if (this.trees[i+1] === 3 && this.trees[i+2] && !this.trees[i+3]){
                    let score = this.score_of_previous_round + (Math.exp(this.cells[this.trees[i]*this.cellI+1] * this.mulA)  
                        + Math.exp(nbr_of_trees[3]*this.mulB) + Math.exp(this.cells[this.trees[i]*this.cellI+8]*this.mulC)) * this.complete_mul / this.iter;
                    if(this.change_commplete){
                        score = this.score_of_previous_round + (Math.exp(this.cells[this.trees[i]*this.cellI+1]) * 2) / this.iter;
                    }
                    actions_score.push([this.play_index, score, COMPLETE, this.trees[i], -1, ...this.last_action.slice(5)]);
                }
            }
            }else{
                const bestTree = {
                score:-9999,
                tree:-1,
            }
            for (let i = 0; i < this.trees.length; i += this.treeI) {
                if (this.trees[i+1] === 3 && this.trees[i+2] && !this.trees[i+3] && this.cells[this.trees[i] * this.cellI + 8] * this.cells[this.trees[i] * this.cellI + 1] > bestTree.score){
                    bestTree.score = this.cells[this.trees[i] * this.cellI + 8] * this.cells[this.trees[i] * this.cellI + 1];
                    bestTree.tree = this.trees.slice(i,i+this.treeI);
                }
            }
            if(bestTree.tree !== -1){
                let score = this.score_of_previous_round + (Math.exp(this.cells[bestTree.tree[0] * this.cellI + 1]*this.mulA)
                     + Math.exp(nbr_of_trees[3]*this.mulB) + Math.exp(this.cells[bestTree.tree[0]*this.cellI+8] * this.mulC)) * this.complete_mul / this.iter;
                if(this.change_commplete){
                    score = this.score_of_previous_round + ( Math.exp(this.cells[bestTree.tree[0]*this.cellI+1]) * 2) / this.iter;
                }
                actions_score.push([this.play_index, score, COMPLETE, bestTree.tree[0], -1, ...this.last_action.slice(5)]);
            }
            }
        }


        // SEED
        if(this.sun >= nbr_of_trees[0] && this.rday < 20){
            if(nbr_of_trees[4] - nbr_of_trees[3] < this.max_tree){
                let mul = 1;
                if(nbr_of_trees[0] === 0){
                    mul = this.seed_mul;
                }else if (this.rday < this.seed_2_phase_day){
                    mul = this.start_seed_mul;
                }
                const bestTree = {
                    score: 9999,
                    tree: -1,
                    spot: -1,
                }

                if(bestTree.tree === -1) {
                    for (let i = 0; i < this.trees.length; i += this.treeI) {
                    if (this.trees[i+2] && this.trees[i+1] > 1 && !this.trees[i+3]){
                        let cells_to_check = [this.trees[i]];
                        for (let j = 0; j < this.trees[i+1]; j++) {
                            let new_cells = [];
                            cells_to_check.forEach(cell =>{
                                this.cells.slice(cell * this.cellI + 2, cell * this.cellI + 8).forEach(spot => {
                                    if (spot !== -1 ){
                                        new_cells.push(spot);
                                        let div = this.cells[spot * this.cellI + 1];
                                        if(this.rday < this.seed_2_phase_day ){
                                            div = 1 + this.cells[spot * this.cellI + 1]/10;
                                        }
                                        if (this.cells[spot * this.cellI + 8] / div < bestTree.score && this.cells[spot * this.cellI + 1] > 0 && !this.isOccupied(spot)){
                                            bestTree.score = this.cells[spot * this.cellI + 8] / div;
                                            bestTree.tree = this.trees.slice(i, i+this.treeI);
                                            bestTree.spot = spot;
                                        }
                                    }
                                });
                            });
                            cells_to_check = new_cells;
                        }
                    }
                }
                }
                if (bestTree.tree !== -1){
                    actions_score.push([
                        this.play_index,
                        this.score_of_previous_round + (mul * this.cells[bestTree.spot * this.cellI + 1] / this.cells[bestTree.spot * this.cellI + 8]) / this.iter,
                        SEED, bestTree.tree[0], bestTree.spot, ...this.last_action.slice(5)
                    ]);
                }
            }
        }


        // GROW
        if (this.sun >= 1 && nbr_of_trees[4] > nbr_of_trees[3]){
            if(this.play_index === -1){
                for (let i = 0; i < this.trees.length; i += this.treeI) {
                if (this.rday <= 20 + this.trees[i+1] && this.trees[i+1] < 3 && this.trees[i+2] && !this.trees[i+3]){
                    let needed_sun;
                    switch (this.trees[i+1]) {
                        case 0:
                            needed_sun = 1 + nbr_of_trees[1];
                            break;
                        case 1:
                            needed_sun = 3 + nbr_of_trees[2];
                            break;
                        case 2:
                            needed_sun = 7 + nbr_of_trees[3];
                            break;
                    }
                    if (this.sun >= needed_sun){
                        actions_score.push([
                        this.play_index,
                        this.score_of_previous_round + (this.cells[this.trees[i] * this.cellI + 1] * this.grow_mul[this.trees[i+1]] / this.cells[this.trees[i] * this.cellI + 8])/this.iter,
                        GROW, this.trees[i], -1, ...this.last_action.slice(5)
                    ]);
                    }
                }
            }
            }else{
            const bestTree = {
                score:[9999, 9999, 9999],
                tree:[-1, -1, -1],
            }
            for (let i = 0; i < this.trees.length; i += this.treeI) {
                if (this.rday <= 20 + this.trees[i+1] && this.trees[i+1] < 3 && this.trees[i+2] && !this.trees[i+3] && this.cells[this.trees[i] * this.cellI + 8] / this.cells[this.trees[i] * this.cellI + 1] < bestTree.score[this.trees[i+1]]){
                    let needed_sun;
                    switch (this.trees[i+1]) {
                        case 0:
                            needed_sun = 1 + nbr_of_trees[1];
                            break;
                        case 1:
                            needed_sun = 3 + nbr_of_trees[2];
                            break;
                        case 2:
                            needed_sun = 7 + nbr_of_trees[3];
                            break;
                    }
                    if (this.sun >= needed_sun){
                        bestTree.score[this.trees[i+1]] = this.cells[this.trees[i] * this.cellI + 8] / this.cells[this.trees[i] * this.cellI + 1];
                        bestTree.tree[this.trees[i+1]] = this.trees.slice(i,i+this.treeI);
                    }
                }
            }
            for (let i = 0 ; i< 3; i++){
                if(bestTree.tree[i] !== -1){
                    actions_score.push([
                        this.play_index,
                        this.score_of_previous_round + (this.cells[bestTree.tree[i][0] * this.cellI + 1] * this.grow_mul[bestTree.tree[i][1]] / this.cells[bestTree.tree[i][0] * this.cellI + 8])/this.iter,
                        GROW, bestTree.tree[i][0], -1, ...this.last_action.slice(5)
                    ]);
                }
            }
            }
        }


        //WAIT
        actions_score.push([this.play_index, this.score_of_previous_round - (this.sun * this.wait_mul) / this.iter, WAIT, -1, -1, ...this.last_action.slice(5)]);

        if(this.play_index === -1){
            actions_score.map((val, i) => {
                val[0] = i;
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
        this.day = 0;
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
        this.cellI = 9;
        this.treeI = 4;

        this.time_stop = 40;

        this.max_rec = 100;
        this.randomly_choosed_action_nbr = 150;
        this.sun_strenght = 0.4;
        this.sun_length = 2;
    }



    castShadows(index, trees, day) {
        const pos_to_check = [];
        let next_pos = index;
        for (let i = 0; i < 3; i++) {
            next_pos = this.cells[next_pos * this.cellI + 2 + (day+3)%6];
            if(next_pos === -1){
                break;
            }
            pos_to_check.push(next_pos);
        }
        for (let i = 0; i < trees.length; i += this.treeI) {
            let shad = trees[i+1];
            if(trees[i+3]){
                shad--;
            }
            if(pos_to_check.includes(trees[i]) && shad >= trees[index+1] && shad > pos_to_check.indexOf(trees[i])){
                return false;
            }
        }
        return true;
    }


    getNumberOfTreesForSun(trees, day, is_shadow_casted) {
        const res = [0,0,0,0];
        for (let i = 0; i < trees.length; i += this.treeI) {
            if(trees[i+2]){
                if(!is_shadow_casted || this.castShadows(i, trees, day)){
                    res[trees[i+1]]++;
                }
            }
        }
        return res;
    }


    updateSunPotential(cells, pos, val) {
        let to_add = cells.slice(pos * this.cellI + 2, pos * this.cellI + 8);
        let to_check = to_add.slice(0);


        for (let i = 1; i < this.sun_length; i++) {
            let new_check = [];
            for (let j = 0; j < 6; j++) {
                if (to_check[j] !== -1){
                    new_check.push(cells[to_check[j] * this.cellI + 2 + j]);
                }else{
                    new_check.push(-1);
                }
            }
            to_add.push(...new_check);
            to_check = new_check;
        }

        to_add = [...new Set(to_add)];
        to_add.forEach(spot => {
            if (spot !== -1 && spot !== pos){
                cells[spot * this.cellI + 8] += val;
            }
        });

        return cells;
    }


    makeAnAction(action) {
        // [play_index, score, action, target, source, trees, cells, sun, day]
        action[5] = action[5].slice(0);
        action[6] = action[6].slice(0);

        if(action[2] === COMPLETE){
            for (let i = 0; i < action[5].length; i+=this.treeI) {
                if (action[5][i] === action[3]){
                    action[7] -= 4;
                    if(this.sun_strenght !== 0){
                        action[6] = this.updateSunPotential(action[6], action[5][i], -this.sun_strenght);
                    }
                    action[5].splice(i, this.treeI);
                    break;
                }
            }
        }else if(action[2] === GROW){
            const nbr_of_trees = this.getNumberOfTreesForSun(action[5], action[8], false);
            for (let i = 0; i < action[5].length; i+= this.treeI) {
                if (action[5][i] === action[3]){
                    switch (action[5][i+1]){
                        case 0:
                            action[7] -= 1 + nbr_of_trees[1];
                            break;
                        case 1:
                            action[7] -= 3 + nbr_of_trees[2];
                            break;
                        case 2:
                            action[7] -= 7 + nbr_of_trees[3];
                            break;
                    }
                    action[5][i+1]++;
                    action[5][i+3] = true;
                    break;
                }
            }
        }else if(action[2] === SEED){
            const nbr_of_trees = this.getNumberOfTreesForSun(action[5], action[8], false);
            action[7] -= nbr_of_trees[0];
            for (let i = 0; i < action[5].length; i+=this.treeI) {
                if (action[5][i] === action[4]){
                    action[5][i+3] = true;
                    break;
                }
            }
            if(this.sun_strenght !== 0){
                action[6] = this.updateSunPotential(action[6], action[3], this.sun_strenght);
            }
            action[5].push(action[3], 0, true, true);
        }else if(action[2] === WAIT){
            if(action[8] < 23){
                for (let i = 0; i < action[5].length; i+=this.treeI) {
                    action[5][i+3] = false;
                }
                const nbr_of_trees = this.getNumberOfTreesForSun(action[5], action[8], true);
                action[7] += nbr_of_trees[1] + nbr_of_trees[2] * 2 + nbr_of_trees[3] * 3;
            }
            action[8]++;
        }

        return action;
    }


    // [play_index, score, action, target, source, trees, cells, sun, day]
    predict() {

        // ---- START ----

        console.error(`day : ${this.day}`);
        const first_actions_layer = new RoundAnalyse([0, 0, WAIT, -1, -1, this.trees, this.cells, this.mySun, this.day], 1, this.nutrients).getActionsScore();
        let last_actions_layer = [];

        first_actions_layer.forEach(action=>{
            last_actions_layer.push(this.makeAnAction(action));
        });



        // ---- LOOP ----

        for (let i=1; i < this.max_rec;i++){
            let is_still_updating = false;
            const new_actions_layer = [];
            last_actions_layer.forEach(action =>{
                if(action[8] > 23){
                    new_actions_layer.push(action);
                }else{
                    is_still_updating = true;
                    new_actions_layer.push(...((new RoundAnalyse(action, i+1, this.nutrients)).getActionsScore()));
                }
            });


            if(!is_still_updating){
                console.error(`stop at ${i} : no more actions`);
                break;
            }

            let sorted_layer = [];
            if (this.randomly_choosed_action_nbr < new_actions_layer.length){
                for (let j = 0; j < this.randomly_choosed_action_nbr; j++) {
                    const index = getRandomInt(0, new_actions_layer.length);
                    sorted_layer.push(new_actions_layer[index]);
                    new_actions_layer.splice(index, 1);
                }
            }else{
                sorted_layer = new_actions_layer;
            }

            last_actions_layer = [];

            sorted_layer.forEach(action => {
                if (action[8] > 23){
                    last_actions_layer.push(action);
                } else {
                    last_actions_layer.push(this.makeAnAction(action));
                }
            });
            const time_dif = (new Date().getTime()) - timeChecker;
            if(time_dif > this.time_stop && rounds_played > 1){
                console.error(`stop at ${i} : OUT OF TIME`);
                break;
            }else if(time_dif > this.time_stop*10 && rounds_played === 1){
                console.error(`stop at ${i} : OUT OF TIME`);
                break;
            }
        }


        // ---- RESULT ----

        let to_print;
        let best_action = {
            score:-9999999,
            action:WAIT,
            sourceIndex:-1,
            targetIndex: -1,
        }

        last_actions_layer.forEach(action => {
            if ((action[1] / action[8]) > best_action.score){
                best_action.score = action[1] / action[8];
                best_action.action = first_actions_layer[action[0]][2];
                best_action.sourceIndex = first_actions_layer[action[0]][4];
                best_action.targetIndex = first_actions_layer[action[0]][3];
                to_print = action;
            }
        });

        console.error(last_actions_layer.length, first_actions_layer.length);
        console.error('BEST ACTION : ');
        console.error(to_print);
        console.error(best_action);

        return new Action(best_action.action, best_action.targetIndex, best_action.sourceIndex);
    }



    getSunPotential() {
        for (let i = 0; i < this.cells.length; i += this.cellI) {
            this.cells[i+8] = 1;
        }
        if(this.sun_strenght === 0){
            return;
        }

        for (let i = 0; i < this.trees.length; i += this.treeI) {
            let to_add = this.cells.slice(this.trees[i] * this.cellI + 2, this.trees[i] * this.cellI + 8);
            let to_check = to_add.slice(0);

            for (let i = 1; i < this.sun_length; i++) {
                let new_check = [];
                for (let j = 0; j < 6; j++) {
                    if (to_check[j] !== -1){
                        new_check.push(this.cells[to_check[j] * this.cellI + 2 +j]);
                    }else{
                        new_check.push(-1);
                    }
                }
                to_add.push(...new_check);
                to_check = new_check;
            }

            to_add = [...new Set(to_add)];
            to_add.forEach(spot => {
                if (spot !== -1 && spot !== this.trees[i]){
                    this.cells[spot * this.cellI + 8] += this.sun_strenght;
                }
            });
        }
    }



    getNextAction() {
        rounds_played++;
        this.getSunPotential();
        return this.predict();
    }
}





// --- Inputs / outputs / game loop ---

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
        ...newCell(index, richness, [neigh0, neigh1, neigh2, neigh3, neigh4, neigh5])
    );
}


const nineWhileNine = (
    '-| Nine While Nine ~~ Sister of Mercy |-\n' +
    'When it\'s passing strange\n' +
    'And I\'m waiting for the train\n' +
    'Caught up on this line again\n' +
    'And it\'s passing slowly\n' +
    'Killing time but it\'s better\n' +
    'Than living in what will come\n' +
    'And I\'ve still got some\n' +
    'Of your letters with me\n' +
    'And I thought sometimes\n' +
    'Or I read too much and I think you know\n' +
    'Let\'s drink to the dead lying under the water\n' +
    'And the cost of the blood on the driven snow\n' +
    'And the lipstick on my cigarettes\n' +
    'Frost upon the window pane\n' +
    'Nine while nine\n' +
    'And I\'m waiting for the train\n' +
    'She said, "Do you remember a time when angels?\n' +
    'Do you remember a time when fear\n' +
    'In the days when I was stronger\n' +
    'In the days when you were here"\n' +
    'She said, "When days had no beginning\n' +
    'While days had no end when shadows grew no longer\n' +
    'I knew no other friend but you were wild"\n' +
    'You were wild\n' +
    'Frost upon these cigarettes\n' +
    'Lipstick on the window pane\n' +
    'And I\'ve lost all sense of the world outside\n' +
    'But I can\'t forget so I call your name\n' +
    'And I\'m looking for a life for me\n' +
    'And I\'m looking for a life for you\n' +
    'And I\'m talking to myself again\n' +
    'And it\'s so damn cold it\'s just not true\n' +
    'And I\'m walking through the rain\n' +
    'Trying to hold on waiting for the train\n' +
    'And I\'m only looking for what you want\n' +
    'But it\'s lonely here and I think you knew\n' +
    'And I\'m, and I\'m waiting\n' +
    'And I wait in vain\n' +
    'Nine while nine\n' +
    'And I\'m waiting for the train\n' +
    'And I\'m waiting\n' +
    'And I wait in vain\n' +
    'Nine while nine\n' +
    'And I\'m waiting for the train\n' +
    'And I\'m waiting\n' +
    'And I wait in vain\n' +
    'Nine while nine\n' +
    'I\'m waiting for the train\n' +
    '-| END |-'
).split('\n');


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
            cellIndex, size, isMine, isDormant
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

    let message = nineWhileNine[(rounds_played-1) % nineWhileNine.length];

    console.log(action.toString(), message);
}
