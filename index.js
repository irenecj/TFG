const Alexa = require('ask-sdk-core');
const AWS = require('aws-sdk');
const DYNAMO = require('./dynamo'); 
AWS.config.update({region:'eu-west-1'});
var ID_GAME = 0000; 

const db = new AWS.DynamoDB.DocumentClient();

const i18n = require("i18next"); 
const sprintf = require('i18next-sprintf-postprocessor'); 
const languageStrings = require('./language-strings');

var persistenceAdapter = getPersistenceAdapter();

const { request } = require('https');
const { count, Console } = require('console');

const stamps = [
    {TREE:  "árbol"},
    {BIKE:  "bicicleta"},
    {PLANET:  "planeta"},
    {TRASH:  "basura"},
    {DROP:  "gota"},
    {RECYCLE:  "reciclaje"},
    {LIGHTBULB:  "bombilla"},
]
 
const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager; 
        const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
        const sessionAttributes = attributesManager.getSessionAttributes(); 

        sessionAttributes['userId'] = Alexa.getUserId(handlerInput.requestEnvelope);

        var game_exists = await DYNAMO.checkGameExists(sessionAttributes['userId']);
        if(!game_exists){
            return NewGameIntentHandler.handle(handlerInput);
        }else{
            var speakOutput = requestAttributes.t('WELCOME_MESSAGE_1');
            var repromptOutput = requestAttributes.t('WELCOME_REPROMPT_MESSAGE');

            ID_GAME = await DYNAMO.getGameCode(sessionAttributes['userId']); 

            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt(repromptOutput)
                .getResponse();
            
        }
    }
};

const RecoverGameIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'RecoverGameIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const intent = handlerInput.requestEnvelope.request.intent;
        const requestAttributes = attributesManager.getRequestAttributes();
        const sessionAttributes = attributesManager.getSessionAttributes();

        var speakOutput; 

        var actual_turn = await DYNAMO.getActualTurn(ID_GAME);
        var numPlayers = await DYNAMO.getNumPlayers(ID_GAME);
        var players = new Array();
        var won_stamps = new Array(); 

        sessionAttributes['num_players'] = await DYNAMO.getNumPlayers(ID_GAME);

        for(let i = 0; i<sessionAttributes['num_players']; i++){
            var player_name = await DYNAMO.getPlayerName(ID_GAME, i);
            if(player_name == actual_turn){
                sessionAttributes['index_player'] = i;
                sessionAttributes['actual_player_id'] = sessionAttributes['index_player'];
              
            }
            players.push(i);
        }

        sessionAttributes['all_players'] = players; 

        sessionAttributes['next_player_id'] = getNextPlayer(sessionAttributes['all_players'], sessionAttributes['actual_player_id']); 
        
        var players_message = "";
        for(var i = 0; i < numPlayers; i++){
            players_message = players_message + await DYNAMO.recoverPlayer(ID_GAME, i); 
            won_stamps = []; 
            for(let value in stamps){
                var stamp_type = Object.values(stamps[value]);
                var stamps_qty = await DYNAMO.getStamps(ID_GAME, i, stamp_type); 
                if(stamps_qty != 0){
                    var stamp_obj = { 
                        type: stamp_type,
                        qty: stamps_qty
                    }
                    won_stamps.push(stamp_obj) 
                }
            }
            if(won_stamps.length == 0){
                players_message = players_message + 'y no tiene ningún sello. ';
            }else{
                players_message = players_message + ' y tiene los siguientes sellos: ';
                for(var element in won_stamps){
                    if(won_stamps[element].qty == 1){
                        var won_stamps_qty = won_stamps[element].qty + ' sello del tipo ';
                    }else{
                        var won_stamps_qty = won_stamps[element].qty + ' sellos del tipo ';
                    }
    
                    players_message = players_message +" "+won_stamps_qty+" "+ won_stamps[element].type + '. <break time="1s" />';              
                }
            }
        }

        speakOutput = requestAttributes.t('RECOVER_GAME_MESSAGE', ID_GAME.toString().split('').join(' <break time="1s"/> ')) + players_message;

        await DYNAMO.updateActualTurn(ID_GAME, actual_turn);
        speakOutput = speakOutput + requestAttributes.t('NEXT_PLAYER_MESSAGE', actual_turn);

        return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();        
    }
}

const NewGameIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(handlerInput.requestEnvelope) === 'NewGameIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager; 
        const intent = handlerInput.requestEnvelope.request.intent;
        const requestAttributes = attributesManager.getRequestAttributes();
        const sessionAttributes = attributesManager.getSessionAttributes(); 

        ID_GAME = await DYNAMO.createGame(); 

        var speakOutput = requestAttributes.t('WELCOME_MESSAGE_2', ID_GAME.toString().split('').join(' <break time="1s"/> '));
        speakOutput = speakOutput + requestAttributes.t('HOW_MANY_PLAYERS_MESSAGE');

        return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();
    }
}

const HowManyPlayersIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'HowManyPlayersIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager; 
        const intent = handlerInput.requestEnvelope.request.intent;
        const requestAttributes = attributesManager.getRequestAttributes();
        const sessionAttributes = attributesManager.getSessionAttributes(); 
        
        const numPlayers = intent.slots.num_players.value; 

        sessionAttributes['num_players'] = numPlayers; 
        sessionAttributes['players_registred'] = 0; 
        
        if(numPlayers > 4){
            return handlerInput.responseBuilder 
                .addElicitSlotDirective(numPlayers)
                .speak(requestAttributes.t('TOO_MANY_PLAYERS_MESSAGE'))
                .reprompt(requestAttributes.t('TOO_MANY_PLAYERS_MESSAGE'))
                .getResponse();
        }else if(numPlayers <= 1){
            return handlerInput.responseBuilder 
                .addElicitSlotDirective(numPlayers)
                .speak(requestAttributes.t('FEW_PLAYERS_MESSAGE'))
                .reprompt(requestAttributes.t('FEW_PLAYERS_MESSAGE'))
                .getResponse();
        }else{
            const speakOutput = requestAttributes.t('START_REGISTRATION_MESSAGE', numPlayers); 
            await DYNAMO.updateNumPlayers(ID_GAME, numPlayers);

            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt(requestAttributes.t('HOW_MANY_PLAYERS_REPROMPT_MESSAGE'))
                .getResponse(); 
        }
    }
};


const RegisterPlayersIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'RegisterPlayersIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager; 
        const requestAttributes = attributesManager.getRequestAttributes();
        const intent = handlerInput.requestEnvelope.request.intent;
        const sessionAttributes = attributesManager.getSessionAttributes(); 
    
        var possible_colours = ["morado", "verde", "azul", "amarillo"];
        var team_colour = intent.slots.team_colour.value; 
        if(possible_colours.includes(team_colour.toLowerCase())){

            for(let i = 0; i<sessionAttributes['num_players']; i++){
                var team_name =  'Equipo ' + team_colour;
                var registered_name = await DYNAMO.getPlayerName(ID_GAME, i);
                if(team_name != registered_name){
                    await DYNAMO.registerPlayer(ID_GAME,sessionAttributes['players_registred'], team_name);

                    sessionAttributes['players_registred']++; 
        
                    return CheckNumPlayersIntentHandler.handle(handlerInput);
                }else{
                    speakOutput = requestAttributes.t('CHOOSEN_TEAM_COLOUR_MESSAGE');
                    return handlerInput.responseBuilder
                        .speak(speakOutput)
                        .reprompt(speakOutput)
                        .getResponse();
                }
            }

            
            
        }else{
            var valid_colours = possible_colours.join(", ");
            speakOutput = requestAttributes.t('NOT_VALID_TEAM_COLOUR', valid_colours);
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt(speakOutput)
                .getResponse(); 

        }
    }
};


const CheckNumPlayersIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'CheckNumPlayersIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager; 
        const requestAttributes = attributesManager.getRequestAttributes();
        const sessionAttributes = attributesManager.getSessionAttributes(); 
        
        let speakOutput; 
        
        if(sessionAttributes['players_registred'] < sessionAttributes['num_players']){
            switch(sessionAttributes['players_registred']){
                case 1:
                    speakOutput = requestAttributes.t('PLAYER_TWO_REG_MESSAGE'); 
                    break;
                case 2:
                    speakOutput = requestAttributes.t('PLAYER_THREE_REG_MESSAGE'); 
                    break;
                case 3: 
                    speakOutput = requestAttributes.t('PLAYER_FOUR_REG_MESSAGE');
                    break;
            }
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt(requestAttributes.t('REPEAT_PLAYER_NAME_MESSAGE'))
                .getResponse();
        }else{
            await DYNAMO.createUserSession(ID_GAME, sessionAttributes['userId']);
           return RandomGameTurnIntentHandler.handle(handlerInput); 
        }
        
    }
};


const RandomGameTurnIntentHandler = { 
    canHandle(handlerInput){
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'RandomGameTurnIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager; 
        const requestAttributes = attributesManager.getRequestAttributes();
        const sessionAttributes = attributesManager.getSessionAttributes(); 
        
       var players = new Array();    

        let speakOutput = requestAttributes.t('ALL_PLAYERS_REG_MESSAGE');

        
        for(let i = 0; i<sessionAttributes['num_players']; i++){
     
            var player_name = await DYNAMO.getPlayerName(ID_GAME, i); 
            if(i == sessionAttributes['num_players'] - 1){
                speakOutput = speakOutput + ' y ' + 'el ' +player_name + "."; 
            }else{
                speakOutput = speakOutput + 'el ' + player_name +  ", " ; 
            }
            players.push(i); 
        }


        sessionAttributes['all_players'] = randomOrder(players); 
        sessionAttributes['index_player'] = 0;

        var first_player = getActualPlayer(sessionAttributes['all_players'],sessionAttributes['index_player']); 
    
        var first_player_name = await DYNAMO.getPlayerName(ID_GAME, first_player); 

        await DYNAMO.updateActualTurn(ID_GAME, first_player_name); 

        speakOutput = speakOutput + requestAttributes.t('RANDOM_START_MESSAGE', first_player_name) + requestAttributes.t('ROLL_DICE_MESSAGE', first_player_name);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('repitiendo')
            .getResponse();
    }
};

const MovePlayerIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(handlerInput.requestEnvelope) === 'MovePlayerIntent'; 
    },
    async handle(handlerInput){
        const attributesManager = handlerInput.attributesManager; 
        const requestAttributes = attributesManager.getRequestAttributes(); 
        const sessionAttributes = attributesManager.getSessionAttributes(); 

        var actual_id_player = sessionAttributes['index_player'];
        sessionAttributes['actual_player_id'] = getActualPlayer(sessionAttributes['all_players'] , actual_id_player); 
        sessionAttributes['next_player_id'] = getNextPlayer(sessionAttributes['all_players'], actual_id_player); 
        var actual_player_name = await DYNAMO.getPlayerName(ID_GAME, sessionAttributes['actual_player_id']);
        
        var speakOutput;

        var dice = await DYNAMO.getDiceResult(ID_GAME); 
        sessionAttributes['dice_result'] = dice;

        if(dice != -1){
            var next_player_selected = false;   
                
            while(!next_player_selected){
                var possible_next_player =  getNextPlayer(sessionAttributes['all_players'] , sessionAttributes['index_player']);
                var lost_turn_player = await DYNAMO.getLostTurn(ID_GAME, possible_next_player );
                if(lost_turn_player){
                    await DYNAMO.updateLostTurn(ID_GAME, possible_next_player, false);
                    sessionAttributes['index_player'] = (sessionAttributes['index_player']+1)%sessionAttributes['all_players'].length;
                    speakOutput = speakOutput + requestAttributes.t('LOST_TURN_MESSAGE',await DYNAMO.getPlayerName(ID_GAME, possible_next_player)); 
                }
                else{
                    next_player_selected = true;
                }  
            }
    
            var next_player_name = await DYNAMO.getPlayerName(ID_GAME,getNextPlayer(sessionAttributes['all_players'],sessionAttributes['index_player']));
            sessionAttributes['index_player'] =  (sessionAttributes['index_player']+1)%sessionAttributes['all_players'].length;

            var pos_actual = await DYNAMO.getPlayerPosition(ID_GAME, sessionAttributes['actual_player_id']); 
            var next_pos = parseInt(pos_actual) + parseInt(dice); 

            if(next_pos > 44){
                speakOutput = requestAttributes.t('POS_BIGGER_THAN_ARRIVAL') + requestAttributes.t('NEXT_PLAYER_MESSAGE', next_player_name  );
            }else if(next_pos == 44){
                await DYNAMO.updatePlayerPosition(ID_GAME, sessionAttributes['actual_player_id'], next_pos);    
                speakOutput = requestAttributes.t('GOAL_ARRIVAL_MESSAGE'); 
            }else{
                await DYNAMO.updatePlayerPosition(ID_GAME, sessionAttributes['actual_player_id'], next_pos);    
                speakOutput = requestAttributes.t('MOVE_PLAYER_MESSAGE', actual_player_name, next_pos); 

                let question_square = true; 
                                         
                let casilla = await DYNAMO.getSquareType(next_pos); 
                speakOutput = speakOutput + requestAttributes.t('SQUARE_TYPE_MESSAGE', casilla); 

                if (casilla == 'dante'){
                    await DYNAMO.updateSquare(ID_GAME,'dante'); 
                    speakOutput = speakOutput + requestAttributes.t('DANTE_MESSAGE'); 
        
                }else if (casilla == 'basura'){
                    await DYNAMO.updateSquare(ID_GAME,'basura'); 
                    var actual_player_name = await DYNAMO.getPlayerName(ID_GAME, sessionAttributes['actual_player_id']); 
                    await DYNAMO.updateLostTurn(ID_GAME, sessionAttributes['actual_player_id'], true);
                    question_square = false; 
                    speakOutput = speakOutput + requestAttributes.t('TRASH_MESSAGE')+ requestAttributes.t('NEXT_PLAYER_MESSAGE', next_player_name  ); 
                    await DYNAMO.updateActualTurn(ID_GAME, next_player_name);

                }else if (casilla == 'sorpresa'){
                    await DYNAMO.updateSquare(ID_GAME,'sorpresa'); 
                    speakOutput = speakOutput + requestAttributes.t('SURPRISE_QUESTION_MESSAGE'); 
        
                }else if (casilla == 'azar'){
                    var colors = ['azul', 'amarillo', 'verde', 'rojo', 'morado'];
                    sessionAttributes['choosen_colors'] = new Array(); 
                    speakOutput = speakOutput + requestAttributes.t('COLORS_PRESENTATION'); 
        
                    var i = 0; 
                    while(i < 3){
                        var random_index = Math.floor(Math.random() * colors.length);
                        var random_color = colors[random_index];
                        sessionAttributes['choosen_colors'].push(random_color); 
                        colors.splice(random_index, 1); 
        
                        if(i == 2){
                            speakOutput = speakOutput + " y " + random_color + "."; 
                        }else{
                            speakOutput = speakOutput + random_color + " "; 
        
                        }
                        i++; 
                    }
                    await DYNAMO.updateSquare(ID_GAME,'azar'); 
                    question_square = false; 
                    speakOutput = speakOutput + requestAttributes.t('CHOOSE_COLOR_EXPLANATION');   
        
                }else if(casilla == 'intercambio de objetivos'){
                    await DYNAMO.updateSquare(ID_GAME,'intercambio de objetivos'); 
                    speakOutput = speakOutput + requestAttributes.t('CHANGE_OBJECTIVES_MESSAGE') + requestAttributes.t('NEXT_PLAYER_MESSAGE', next_player_name )
                    question_square = false; 
                    await DYNAMO.updateActualTurn(ID_GAME, next_player_name);

                }else if(casilla == 'conocimiento'){
                    await DYNAMO.updateSquare(ID_GAME,'conocimiento'); 
                    speakOutput = speakOutput + requestAttributes.t('GET_KNOWLEDGE_QUESTION'); 

                }else if(casilla == 'acción'){
                    await DYNAMO.updateSquare(ID_GAME,'acción'); 
                    speakOutput = speakOutput + requestAttributes.t('GET_ACTION_QUESTION'); 

                }else if(casilla == 'neutral'){
                    await DYNAMO.updateSquare(ID_GAME, 'neutral');
                    speakOutput = speakOutput + requestAttributes.t('NEUTRAL_SQUARE_MESSAGE');                   
                    speakOutput = speakOutput + requestAttributes.t('NEXT_PLAYER_MESSAGE',next_player_name);
                    question_square = false; 
                    await DYNAMO.updateActualTurn(ID_GAME, next_player_name);

                }else if(casilla  == 'robar'){
                    question_square = false;
                    await DYNAMO.updateSquare(ID_GAME, 'robar'); 
                    speakOutput = speakOutput + requestAttributes.t('STEAL_SQUARE_MESSAGE', actual_player_name);

                }else{
                    speakOutput = speakOutput + requestAttributes.t('UNKNOWN_SQUARE_MESSAGE'); 
                    question_square = false; 
                }
            }

        }else{
            speakOutput = requestAttributes.t('REPEAT_DICE_SCAN_MESSAGE');  

            return handlerInput.responseBuilder 
            .speak(speakOutput)
            .reprompt( requestAttributes.t('REPEAT_DICE_SCAN_MESSAGE'))
            .getResponse(); 
        }
        
        await DYNAMO.clearDiceValue(ID_GAME); 
        sessionAttributes['move_player_message'] = speakOutput;

        return handlerInput.responseBuilder 
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse(); 
    }
}

const GetQuestionOptionsHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetQuestionOptionsIntent'
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const requestAttributes = attributesManager.getRequestAttributes();
        const sessionAttributes = attributesManager.getSessionAttributes();
        const intent = handlerInput.requestEnvelope.request.intent;

        let speakOutput;

        let question_code = await DYNAMO.getQuestionCode(ID_GAME);
        let question_type = await DYNAMO.getQuestionType(question_code);
        let actual_square = await DYNAMO.getSquare(ID_GAME);
        let repeat_type = "";
        if( (actual_square == 'acción' || actual_square == 'conocimiento') && actual_square != question_type.toLowerCase() || (actual_square == 'dante' && question_type != 'Conocimiento')) {
            repeat_type = actual_square;
            if(actual_square == 'dante'){
                repeat_type = 'conocimiento';
            }
            speakOutput = requestAttributes.t('REPEAT_CARD_MESSAGE', repeat_type);  

            return handlerInput.responseBuilder 
            .speak(speakOutput)
            .reprompt( requestAttributes.t('REPEAT_CARD_MESSAGE', actual_square))
            .getResponse(); 
        }else{
            let question_text = await DYNAMO.getQuestionText(question_code);
            speakOutput = question_text + " ";
    
            let question_options = await DYNAMO.getAllOptions(question_code);
            speakOutput = speakOutput + question_options + '<break time="3s"/>';
            sessionAttributes['question'] = speakOutput;
    
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt(speakOutput)
                .getResponse();
        }
        
    }
}

const PlayerResponseIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'PlayerResponseIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager; 
        const requestAttributes = attributesManager.getRequestAttributes();
        const sessionAttributes = attributesManager.getSessionAttributes(); 
        const intent = handlerInput.requestEnvelope.request.intent;

        let speakOutput;

        /*var stamps_values = Object.keys(stamps); 
        var enumKey = stamps_values[Math.floor(Math.random() * stamps_values.length)]; 
        var random_stamp= Object.values(stamps[enumKey]);*/
        var question_code = await DYNAMO.getQuestionCode(ID_GAME);
        var stamp = await DYNAMO.getQuestionStamp(question_code);
        var actual_stamps_qty = await DYNAMO.getStamps(ID_GAME, sessionAttributes['actual_player_id'], stamp);

        let square = await DYNAMO.getSquare(ID_GAME);  

        let correct_option = await DYNAMO.getCorrectOption(question_code);
        let correct_option_text = await DYNAMO.getCorrectOptionText(question_code,correct_option);
        let player_answer = await DYNAMO.getSelectedAnswer(ID_GAME); 
        let next_player = await DYNAMO.getPlayerName(ID_GAME, getActualPlayer(sessionAttributes['all_players'],sessionAttributes['index_player'])); 
        var actual_pos = await DYNAMO.getPlayerPosition(ID_GAME, sessionAttributes['actual_player_id']);
        var actual_player_name = await DYNAMO.getPlayerName(ID_GAME, sessionAttributes['actual_player_id']); 

        if( (player_answer == "A" || player_answer == "B" || player_answer == "C") || square == 'azar' || square == 'robar'){
            //CORRECT ANSWER
            if(player_answer === correct_option || square == 'azar' || square == 'robar') {
                if(square == 'sorpresa'){
                    var new_pos = parseInt(actual_pos) + 3; 
                    await DYNAMO.updatePlayerPosition(ID_GAME, sessionAttributes['actual_player_id'], new_pos); 
                    await DYNAMO.updateSquare(ID_GAME,'knowledge'); 
                    speakOutput = requestAttributes.t('CORRECT_SURPRISE_MESSAGE', new_pos)+requestAttributes.t('GET_KNOWLEDGE_QUESTION'); 


                }else if(square == 'dante'){
                    speakOutput = requestAttributes.t('CORRECT_DANTE_MESSAGE'); 

                }else if(square == 'robar'){
                    var choosen_stamp = intent.slots.choosen_stamp.value;
                    stamps_qty = await DYNAMO.getStamps(ID_GAME, sessionAttributes['actual_player_id'], choosen_stamp); 

                    if(stamps_qty > 0){
                        actual_stamps_qty = await DYNAMO.getStamps(ID_GAME, sessionAttributes['actual_player_id'], choosen_stamp); 
                        var new_stamps_qty = parseInt(actual_stamps_qty) - 1;     
                        await DYNAMO.updateStamps(ID_GAME, sessionAttributes['actual_player_id'], choosen_stamp, new_stamps_qty); 
                        speakOutput = requestAttributes.t('STEAL_STAMP', actual_player_name, choosen_stamp);
                    }else{
                        speakOutput = requestAttributes.t('STEAL_NO_STAMP', actual_player_name, choosen_stamp);   
                    }

                }else if(square == "azar"){
                    let choosen_color = intent.slots.choosen_color.value; 
                    if(sessionAttributes['choosen_colors'].includes(choosen_color)){
                        var random_stamp = await checkStampsQty(stamps,sessionAttributes['actual_player_id']);
                        let color_texts = [requestAttributes.t('LOSE_STAMP', random_stamp), requestAttributes.t('WIN_STAMP', random_stamp), requestAttributes.t('NOTHING_HAPPENS'), requestAttributes.t('KNOWLEDGE_QUESTION'), requestAttributes.t('ACTION_QUESTION'), requestAttributes.t('GO_HOME')]
                    
                        var choosen_text = color_texts[Math.floor(Math.random() * color_texts.length)];
        
                        speakOutput = choosen_text; 
        
                        if(choosen_text == requestAttributes.t('LOSE_STAMP', random_stamp) || choosen_text == requestAttributes.t('WIN_STAMP',random_stamp)){
                            
                            if(random_stamp != -1){
                                speakOutput = speakOutput + " " + requestAttributes.t('NEXT_PLAYER_MESSAGE', next_player); 
                            }else{
                                speakOutput = requestAttributes.t('BAD_NOSTAMP_MESSAGE') + " " + requestAttributes.t('NEXT_PLAYER_MESSAGE', next_player); 
                            }

                        }else if(choosen_text == requestAttributes.t('GET_KNOWLEDGE_QUESTION') ){
                            await DYNAMO.updateSquare(ID_GAME,'knowledge'); 

                        }else if(choosen_text == requestAttributes.t('GET_ACTION_QUESTION') ){
                            await DYNAMO.updateSquare(ID_GAME,'action'); 

                        }else if(choosen_text == requestAttributes.t('GO_HOME')){
                            await DYNAMO.updatePlayerPosition(ID_GAME, sessionAttributes['actual_player_id'], 0); 
                            speakOutput = speakOutput + " " + requestAttributes.t('NEXT_PLAYER_MESSAGE', next_player);
                            await DYNAMO.updateActualTurn(ID_GAME, next_player);

                        }else if(choosen_text == requestAttributes.t('NOTHING_HAPPENS')){
                            speakOutput = speakOutput + " " + requestAttributes.t('NEXT_PLAYER_MESSAGE', next_player); 
                            await DYNAMO.updateActualTurn(ID_GAME, next_player);
                        }

                        speakOutput = speakOutput; 

                        return handlerInput.responseBuilder
            
                            .speak(speakOutput)
                            .reprompt(requestAttributes.t('REPEAT_RESPONSE_SCAN_MESSAGE')) 
                            .getResponse();
                            
                    }else{
                        speakOutput = requestAttributes.t('REMEMBER_CHOOSE_COLOR_MESSAGE');  
                        return handlerInput.responseBuilder 
                            .speak(speakOutput) 
                            .reprompt('')
                            .getResponse(); 
                    }
                
                }else{    
                    speakOutput = requestAttributes.t('CORRECT_ANSWER_MESSAGE') + requestAttributes.t('WON_STAMP_MESSAGE', stamp);
        
                    await DYNAMO.clearQuestionCode(ID_GAME);
                    var total_stamps = parseInt(actual_stamps_qty) + 1; 
                    await DYNAMO.updateStamps(ID_GAME, sessionAttributes['actual_player_id'], stamp, total_stamps); 
                }

            //INCORRECT ANSWER
            }else{
                speakOutput = requestAttributes.t('BAD_ANSWER_MESSAGE',correct_option,correct_option_text);

                if(square == 'surprise'){
                    var new_pos = parseInt(actual_pos) - 2; 
                    await DYNAMO.updatePlayerPosition(ID_GAME, sessionAttributes['actual_player_id'], new_pos); 
                    speakOutput = requestAttributes.t('BAD_SURPRISE_MESSAGE', new_pos); 
            
            
                }else{
                    var random_stamp = await checkStampsQty(stamps,sessionAttributes['actual_player_id']); 
                    if(random_stamp != -1){
                        speakOutput = speakOutput + requestAttributes.t('BAD_STAMP_MESSAGE', random_stamp);  
                    }else{
                        speakOutput = speakOutput + requestAttributes.t('BAD_NOSTAMP_MESSAGE'); 
                    }
                }
            }
            speakOutput = speakOutput + " " + requestAttributes.t('NEXT_PLAYER_MESSAGE', next_player); 
            await DYNAMO.updateActualTurn(ID_GAME, next_player);

        }else{
            speakOutput = requestAttributes.t('REPEAT_RESPONSE_SCAN_MESSAGE'); 
        }
        
        await DYNAMO.updateSelectedAnswer(ID_GAME," ");
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(requestAttributes.t('REPEAT_RESPONSE_SCAN_MESSAGE'))
            .getResponse();
    }
};

const CheckTotalStampsIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' 
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'CheckTotalStampsIntent'; 
    },
    async handle(handlerInput){
        const attributesManager = handlerInput.attributesManager; 
        const requestAttributes = attributesManager.getRequestAttributes();
        const sessionAttributes = attributesManager.getSessionAttributes(); 
        
        var speakOutput; 

        var actual_pos = await DYNAMO.getPlayerPosition(ID_GAME, sessionAttributes['actual_player_id']); 
        var next_player_name = await DYNAMO.getPlayerName(ID_GAME, sessionAttributes['next_player_id']); 
        if(actual_pos != 44){
            speakOutput = requestAttributes.t('NOT_LAST_SQUARE_MESSAGE', next_player_name);  
        }else{
            speakOutput = requestAttributes.t('LAST_SQUARE_MESSAGE');  
            var total_stamps = 0; 
            var no_stamps = new Array(); 
            var won_stamps = new Array(); 
    
            for(let value in stamps){
                var stamp_type = Object.values(stamps[value]);
                var stamps_qty = await DYNAMO.getStamps(ID_GAME, sessionAttributes['actual_player_id'], stamp_type); 
                if(stamps_qty == 0){
                    no_stamps.push(stamp_type); 
                }else{
                    var stamp_obj = { 
                        type: stamp_type,
                        qty: stamps_qty
                    }
                    won_stamps.push(stamp_obj) 
                }
                total_stamps = total_stamps + stamps_qty; 
            }
    
            var next_player_name =  await DYNAMO.getPlayerName(ID_GAME, sessionAttributes['next_player_id']);
            if(total_stamps ==  0){
                speakOutput = speakOutput + requestAttributes.t('ZERO_STAMPS_MESSAGE') + requestAttributes.t('NEXT_PLAYER_MESSAGE',next_player_name); 
                await DYNAMO.updatePlayerPosition(ID_GAME, sessionAttributes['actual_player_id'],0);
                await DYNAMO.updateActualTurn(ID_GAME, next_player_name);

            }else{
                speakOutput = requestAttributes.t('NO_STAMPS_TYPE_MESSAGE'); 
                for(var i = 0; i < no_stamps.length; i++){
                    speakOutput = speakOutput + no_stamps[i] + ', ';
                    if(i == no_stamps.length){
                        speakOutput = speakOutput + ' y ' + no_stamps[i] ;
                    } 
                }
                
                speakOutput = speakOutput + requestAttributes.t('STAMPS_TYPE_MESSAGE')
                for(var element in won_stamps){
                    if(won_stamps[element].qty == 1){
                        var won_stamps_qty = won_stamps[element].qty + ' sello del tipo ';
                    }else{
                        var won_stamps_qty = won_stamps[element].qty + ' sellos del tipo ';
                    }
    
                    if(element == won_stamps.length){
                        speakOutput = speakOutput +" "+won_stamps_qty+" "+ won_stamps[element].type + '.'; 
                    }else{
                        speakOutput = speakOutput +" "+won_stamps_qty+" "+ won_stamps[element].type + ', '; 
                    }                
                }
                var actual = await DYNAMO.getPlayerName(ID_GAME, getActualPlayer(sessionAttributes['all_players'],sessionAttributes['index_player'])); 
                speakOutput = speakOutput +' '+ actual + requestAttributes.t('SCAN_MISSION_CART_MESSAGE'); 
            }
        }
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
}

const FinishGameIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' 
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'FinishGameIntent'; 
    },
    async handle(handlerInput){
        const attributesManager = handlerInput.attributesManager; 
        const requestAttributes = attributesManager.getRequestAttributes();
        const sessionAttributes = attributesManager.getSessionAttributes(); 
        var speakOutput;


        var next_player_name =  await DYNAMO.getPlayerName(ID_GAME, sessionAttributes['next_player_id']);
        //Comprobamos si los sellos del jugador que ha finalizado tienen los sellos suficientes de la carta escaneada.
        //Id carta mision:
        var id_mission_card = await DYNAMO.getMissionCard(ID_GAME);
        console.log('MISIÓN CARD');
        console.log(id_mission_card);
        var winner = true;
        if(id_mission_card != "-1"){
            //Por cada sello vamos a obtener los que tiene la carta objetivo y los que tiene el jugador de ese tipo
            var value = 0;
            while(winner && value<stamps.length){
                var stamp_type = Object.values(stamps[value]);
                var player_stamps_qty = await DYNAMO.getStamps(ID_GAME, sessionAttributes['actual_player_id'], stamp_type);
                var card_stamps_qty = await DYNAMO.getStamps(ID_GAME, id_mission_card, stamp_type,'mission_cards');

                console.log(id_mission_card);
                console.log(player_stamps_qty); 
                console.log(card_stamps_qty);

                if(player_stamps_qty < card_stamps_qty){
                    console.log('entro false');
                    winner = false;
                }
                value += 1;
            }

            
            if(winner){
                for(var i = 0; i < sessionAttributes['num_players']; i++){
                    await DYNAMO.deletePlayer(ID_GAME, i); 
                }
                await DYNAMO.finishGame(ID_GAME);
                await DYNAMO.deleteSession(sessionAttributes['userId']);

                speakOutput = requestAttributes.t('COMPLETE_MISSION_MESSAGE'); 
                handlerInput.attributesManager.setSessionAttributes({});

                return handlerInput.responseBuilder
                .speak(speakOutput)
                .withShouldEndSession(true)
                .getResponse();
    
            }
            else{
                speakOutput = requestAttributes.t('INCOMPLETE_MISSION_MESSAGE')+requestAttributes.t('NEXT_PLAYER_MESSAGE',next_player_name); 
                await DYNAMO.updatePlayerPosition(ID_GAME, sessionAttributes['actual_player_id'],0);
                await DYNAMO.updateActualTurn(ID_GAME, next_player_name);

                return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt(speakOutput)
                .getResponse();
            }


        }else{
            speakOutput = requestAttributes.t('REPEAT_MISSION_SCAN_MESSAGE'); 
            
            return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
        }


        
    }
}

const RepeatQuestionIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'RepeatQuestionIntent';
    },
    handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager; 
        const sessionAttributes = attributesManager.getSessionAttributes(); 
        const requestAttributes = attributesManager.getRequestAttributes();

        const speakOutput = requestAttributes.t('REPEAT_QUESTION_MESSAGE') + sessionAttributes['question'];
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
}

const RepeatDiceResultIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'RepeatDiceResultIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager; 
        const sessionAttributes = attributesManager.getSessionAttributes(); 
        const requestAttributes = attributesManager.getRequestAttributes();

        const speakOutput = requestAttributes.t('REPEAT_DICE_MESSAGE') + sessionAttributes['dice_result'];
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
}

const RepeatSquareIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'RepeatSquareIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager; 
        const sessionAttributes = attributesManager.getSessionAttributes(); 
        const requestAttributes = attributesManager.getRequestAttributes();

        const speakOutput = sessionAttributes['move_player_message'];
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
}

const RepeatGameCodeIntentHandler = {
    canHandle(handlerInput){
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(handlerInput.requestEnvelope) === 'RepeatGameCodeIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager; 
        const sessionAttributes = attributesManager.getSessionAttributes(); 
        const requestAttributes = attributesManager.getRequestAttributes();

        const speakOutput = requestAttributes.t('REPEAT_GAME_CODE_MESSAGE', ID_GAME.toString().split('').join(' <break time="1s"/>'));

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
}

const RepeatPlayerTurnIntentHandler = {
    canHandle(handlerInput){
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(handlerInput.requestEnvelope) === 'RepeatPlayerTurnIntent';
    },
    async handle(handlerInput) {
        const attributesManager = handlerInput.attributesManager; 
        const sessionAttributes = attributesManager.getSessionAttributes(); 
        const requestAttributes = attributesManager.getRequestAttributes();

        var actual_turn = await DYNAMO.getActualTurn(ID_GAME);
        const speakOutput = requestAttributes.t('REPEAT_PLAYER_TURN_MESSAGE', actual_turn);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
}

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'You can say hello to me! How can I help?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        handlerInput.attributesManager.setSessionAttributes({})

        const speakOutput = 'Goodbye!';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .withShouldEndSession(true)
            .getResponse();
    }
};
/* *
 * FallbackIntent triggers when a customer says something that doesn’t map to any intents in your skill
 * It must also be defined in the language model (if the locale supports it)
 * This handler can be safely added but will be ingnored in locales that do not support it yet 
 * */
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Sorry, I don\'t know about that. Please try again.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
/* *
 * SessionEndedRequest notifies that a session was ended. This handler will be triggered when a currently open 
 * session is closed for one of the following reasons: 1) The user says "exit" or "quit". 2) The user does not 
 * respond or says something that does not match an intent defined in your voice model. 3) An error occurs 
 * */
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`);
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse(); // notice we send an empty response
    }
};
/* *
 * The intent reflector is used for interaction model testing and debugging.
 * It will simply repeat the intent the user said. You can create custom handlers for your intents 
 * by defining them above, then also adding them to the request handler chain below 
 * */
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};
/**
 * Generic error handling to capture any syntax or routing errors. If you receive an error
 * stating the request handler chain is not found, you have not implemented a handler for
 * the intent being invoked or included it in the skill builder below 
 * */
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        const speakOutput = 'Sorry, I had trouble doing what you asked. Please try again.';
        console.log(error); 
        console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const HelloWorldIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'HelloWorldIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Hello World!';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};
/* ------------------------------------------------------------------------------------------- */
async function checkStampsQty(stamps, player_id){
    var hasStamps = false; 
    var player_stamps = new Array(); 

    for(let value in stamps){
        stamps_qty = await DYNAMO.getStamps(ID_GAME, player_id, Object.values(stamps[value])); 
        if(stamps_qty > 0){
            hasStamps = true;
            player_stamps.push(Object.values(stamps[value]));  
        }
    }

    if(hasStamps){
        var random_stamp = player_stamps[Math.floor(Math.random() * player_stamps.length)];

        actual_stamps_qty = await DYNAMO.getStamps(ID_GAME, player_id, random_stamp); 

        var new_stamps_qty = parseInt(actual_stamps_qty) - 1;     

        await DYNAMO.updateStamps(ID_GAME, player_id, random_stamp, new_stamps_qty); 
        return random_stamp; 
    }else{
        var random_stamp = -1; 
        return random_stamp; 
    }
}
function randomOrder(players){
    players.sort(function(a, b){return 0.5 - Math.random()});
    return players; 
}

function getActualPlayer(players , index_player){
    console.log('PLAYERS');
    console.log(players);
    console.log('INDEX');
    console.log(index_player);
    var player_id = players[index_player]; 
    return player_id; 
}

function getNextPlayer(players,index_player){
    var player_id = players[(index_player+1)%players.length]; 
    return player_id; 
}

function changeActualPlayer(players){
    var inicial = players[0]; 
    for(var i = 0; i < players.length-1; i++){
       players[i] = players[ (i+1) % players.length]; 
    }
    players[players.length-1] = inicial; 
}

function getPersistenceAdapter() {
    // This function is an indirect way to detect if this is part of an Alexa-Hosted skill
    function isAlexaHosted() {
        return process.env.S3_PERSISTENCE_BUCKET ? true : false;
    }
    const tableName = 'save-planet-session';
    if(isAlexaHosted()) {
        const {S3PersistenceAdapter} = require('ask-sdk-s3-persistence-adapter');
        return new S3PersistenceAdapter({ 
            bucketName: process.env.S3_PERSISTENCE_BUCKET
        });
    } else {
        // IMPORTANT: don't forget to give DynamoDB access to the role you're to run this lambda (IAM)
        const {DynamoDbPersistenceAdapter} = require('ask-sdk-dynamodb-persistence-adapter');
        return new DynamoDbPersistenceAdapter({ 
            tableName: tableName,
            createTable: true
        });
    }
}

function mixAnswers(answers, handlerInput){
    const attributesManager = handlerInput.attributesManager; 
    const sessionAttributes = attributesManager.getSessionAttributes(); 
    
    //mezclamos las respuestas, ya que en nuestro JS la primera siempre es la correcta
    for(let i = answers.length - 1; i > 0; i--){
        let random_position = Math.floor(Math.random() * (i+1)); //obtenemos índice aleatorio en los límites del array 
        let temp = answers[i]; //guardamos el valor actual en temp 
        answers[i] = answers[random_position]; // ponemos el aleatorio en el actual
        answers[random_position] = temp; //guardamos el temp en el aleatorio
    }
    
    //vemos en qué posición está la respuesta correcta 
    for(let i = 0; i<answers.length; i++){
        if(answers[i] === sessionAttributes['correct_answer_text']){
            sessionAttributes['correct_answer_position'] = i; 
        }
    }
    
    return answers;
}

const LoggingRequestInterceptor = {
    process(handlerInput) {
        console.log('Incoming request: $(JSON.stringify(handlerInput.requestEnvelope.request)}');
    }
};

const LoggingResponseInterceptor = {
    process(handlerInput, response) {
        console.log('Outgoing response: $(JSON.stringify(response)}');
    }
};

const LocaleInterceptor = {
    process(handlerInput) {
        const localizationClient = i18n.use(sprintf).init({
            lng: handlerInput.requestEnvelope.request.locale,
            overloadTranslationOptionHandler: sprintf.overloadTranslationOptionHandler,
            resources: languageStrings,
            returnObjects: true,
        });
        localizationClient.localize = function () {
            const args = arguments;
            let values = [];

            for (var i = 1; i < args.length; i++) {
                values.push(args[i]);
            }
            const value = i18n.t(args[0], {
                returnObjects: true,
                postProcess: 'sprintf',
                sprintf: values
            });

            if (Array.isArray(value)) {
                return value[Math.floor(Math.random() * value.length)];
            } else {
                return value;
            }
        }
        const attributes = handlerInput.attributesManager.getRequestAttributes();
        attributes.t = function (...args) {
            return localizationClient.localize(...args);
        };
    },
};

const LoadAttributesRequestInterceptor = {
    async process(handlerInput) {
        if(handlerInput.requestEnvelope.session['new']){ //is this a new session?
            const attributesManager = handlerInput.attributesManager; 
            const persistentAttributes = await attributesManager.getPersistentAttributes() || {};
            //copy persistent attribute to session attributes
            handlerInput.attributesManager.setSessionAttributes(persistentAttributes);
        }
    }
};

const SaveAttributesResponseInterceptor = {
    async process(handlerInput, response) {
        const attributesManager = handlerInput.attributesManager; 
        const sessionAttributes = attributesManager.getSessionAttributes();
        const shouldEndSession = (typeof response.shouldEndSession === "undefined" ? true : response.shouldEndSession);//is this a session end?
        if(shouldEndSession || handlerInput.requestEnvelope.request.type === 'SessionEndedRequest') { // skill was stopped or timed out            
            attributesManager.setPersistentAttributes(sessionAttributes);
           await attributesManager.savePersistentAttributes();
        }
    }
};

/*const ReadAttributesHandler = {
    async handle(handlerInput){

    const attributesManager = handlerInput.attributesManager;
    const attributes = await attributesManager.getPersistentAttributes() || {};
    console.log('attributes is: ', attributes);

    const counter = attributes.hasOwnProperty('counter')? attributes.counter : 0;

    let speechOutput = `Hi there, Hello World! Your counter is ${counter}`;

    return handlerInput.responseBuilder
        .speak(speechOutput)
        .getResponse();
    }
};

const SaveAttributesHandler = {
    async handle(handlerInput)
    {
        const attributesManager = handlerInput.attributesManager;
        let attributes = {"counter":10};
    
        attributesManager.setPersistentAttributes(attributes);
        await attributesManager.savePersistentAttributes();
    
        let speechOutput = `Hi there, Hello World! Your saved counter is ${attributes.counter}`;
    
        return handlerInput.responseBuilder
            .speak(speechOutput)
            .getResponse();
    }
};*/




/**
 * This handler acts as the entry point for your skill, routing all request and response
 * payloads to the handlers above. Make sure any new handlers or interceptors you've
 * defined are included below. The order matters - they're processed top to bottom 
 * */
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        RecoverGameIntentHandler,
        NewGameIntentHandler,
        HelloWorldIntentHandler,
        HowManyPlayersIntentHandler,
        RegisterPlayersIntentHandler,
        CheckNumPlayersIntentHandler,
        GetQuestionOptionsHandler,
        PlayerResponseIntentHandler,
        CheckTotalStampsIntentHandler,
        FinishGameIntentHandler,
        RepeatQuestionIntentHandler,
        RepeatDiceResultIntentHandler,
        RepeatSquareIntentHandler,
        RepeatGameCodeIntentHandler,
        RepeatPlayerTurnIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler,
        MovePlayerIntentHandler,
        //ReadAttributesHandler,
        //SaveAttributesHandler,
        IntentReflectorHandler)
    .addErrorHandlers(
        ErrorHandler)
    .addRequestInterceptors(LocaleInterceptor, LoadAttributesRequestInterceptor)
    .addResponseInterceptors(SaveAttributesResponseInterceptor)
    .withPersistenceAdapter(persistenceAdapter)
    .withCustomUserAgent('sample/hello-world/v1.2')
    .lambda();