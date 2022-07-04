const Alexa = require('ask-sdk-core');
const AWS = require('aws-sdk');
AWS.config.update({region:'eu-west-1'});

const db = new AWS.DynamoDB();

const getGameId = async function(){
    var id_game = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXZ0123456789"

    for(var i = 0; i < 4; i++){
        id_game += possible.charAt(Math.floor(Math.random() * possible.length));
    }    

    id_game = id_game.toUpperCase();
    
    return id_game;
}

const checkGameExists = async function(user_id){
    const params = {
        TableName: 'user_game',
        Key: {
            user_id: {
                S: user_id.toString()
            }
        }
    }; 

    return await db
        .getItem(params)
        .promise()
        .then((res) => {
            if(res.Item != undefined){
                return true;
            }else{
                return false;
            }
        }).catch((err) => {
            console.log('Unable to get game id', err); 
            return false;
        })
}

const getGameCode = async function(user_id){
    const params = {
        TableName: 'user_game',
        Key: {
            user_id: {
                S: user_id.toString()
            }
        }
    };

    return await db
        .getItem(params)
        .promise()
        .then((res) => {
            if(res.Item != undefined){
                var result = res.Item.game_code.S;
                return result;
            }else{
                return false;
            }
        }).catch((err) => {
            console.log('Unable to get game code', err);
            return false;
        })
}

const createGame = async function(){
    var game_id = await getGameId();

    var params = { 
        TableName: 'game_data', 
        Item: {
            "game_code" : {
                S: game_id.toString()
            }, 
            "actual_turn" : {
                S: " "
            }, 
            "dice" : {
                S: (-1).toString()
            }, 
            "num_players" : {
                N: (-1).toString()
            }, 
            "mission_card" : {
                N: (-1).toString()
            },
            "question_code" : {
                S: " "
            },
            "question_type" : {
                S: " "
            },
            "selected_answer" : {
                S: " "
            },
            "square" : {
                S: " "
            }  ,
        }
    };

    return await db 
        .putItem(params)
        .promise()
        .then((res) => {
            return game_id; 
        }).catch((err) => {
            console.log('Unable to create game. Error: ', err); 
            return false; 
        });

}

const createUserSession = async function(game_code, user_id){
    var params = { 
        TableName: 'user_game', 
        Item: {
            "user_id" : {
                S: user_id.toString()
            }, 
            "game_code" : {
                S: game_code.toString()
            },
        }
    };

    return await db 
        .putItem(params)
        .promise()
        .then((res) => {
            return true; 
        }).catch((err) => {
            console.log('Unable to create user session. Error: ', err); 
            return false; 
        });
}

const finishGame = async function(game_id){
    var params = {
        TableName: 'game_data', 
        Key: {
            game_code : {
                S: game_id.toString()
            }
        }
    };

    return await db 
        .deleteItem(params)
        .promise()
        .then((res) => {
            return true;
        }).catch((err) => {
            console.log('Unable to delete game. Error: ', err); 
            return false; 
        })
}

const deletePlayer = async function(id_game, player_id){
    var params = {
        TableName: 'players', 
        Key: {
            id : {
                N: player_id.toString()
            },
            id_game : {
                S: id_game.toString()
            }
        }
    };

    return await db 
        .deleteItem(params)
        .promise()
        .then((res) => {
            return true;
        }).catch((err) => {
            console.log('Unable to delete player. Error: ', err); 
            return false;
        })
}


const deleteSession = async function(user_id){
    var params = {
        TableName: 'save-planet-session', 
        Key: {
            id : {
               S: user_id.toString()
            }
        }
    };

    return await db 
        .deleteItem(params)
        .promise()
        .then((res) => {
            return true;
        }).catch((err) => {
            console.log('Unable to delete user session. Error: ', err); 
            return false;
        })
}

const getNumPlayers = async function(game_id){
    var params = {
        TableName: 'game_data', 
        Key: {
            game_code: {
                S: game_id.toString()
            }
        }
    };

    return await db
        .getItem(params)
        .promise()
        .then((res) => {
            var result = res.Item.num_players.N;
            return result;
        }).catch((err) => {
            console.log('Unable to get num players', err); 
        })
}

const updateNumPlayers = async function(game_id, numPlayers){
    var params = {
        TableName: 'game_data', 
        Key:{
            game_code : {
                S: game_id.toString()
            } 
        },
        UpdateExpression: "set num_players = :x",
        ExpressionAttributeValues: {
            ":x": {
                N: numPlayers.toString()
            }
        }
    }

    return await db 
        .updateItem(params)
        .promise()
        .then((res) => {
            return true; 
        }).catch((err) => {
            console.log('Unable to update num_players. Error: ',err); 
            return false; 
        });
}

const registerPlayer = async function(id_game,player_id, player_name){
    var params = {
        TableName: 'players',
        Item: {
            "id": {
                N: player_id.toString()
            },
            "id_game": {
                S: id_game.toString()
            },
            "name":{
                S: player_name
            },
            "pos":{
                N: "0"
            },
            "lost_turn" : {
                BOOL: false
            }, 
            "stamp_tree": {
                N: "0"
            }, 
            "stamp_planet": {
                N: "0"
            }, 
            "stamp_bike": {
                N: "0"
            }, 
            "stamp_trash": {
                N: "0"
            }, 
            "stamp_drop": {
                N: "0"
            },
            "stamp_lightbulb": {
                N: "0"
            },
            "stamp_recycle": {
                N: "0"
            }   
        }
    }

    return await db 
        .putItem(params)
        .promise()
        .then((res) => {
            return true; 
        }).catch((err) => {
            console.log('Unable to add player. Error: ', err); 
            return false; 
        });
}

const getPlayerName = async function(game_id, player_id){
    let params = {
        TableName: 'players',
        Key: {
            id_game: {
                S: game_id.toString()
            },
            id: {
                N: player_id.toString()
            }
        }
    };

    return await db
        .getItem(params)
        .promise()
        .then((res) => {
            console.log(res);
            var result = res.Item.name.S; 
            return result; 
        })
        .catch((err) => {
            console.log('Unable to get player name. Error: ', err); 
            return false; 
        });
};

const getPlayerPosition = async function(id_game, player_id){
    let params = {
        TableName: 'players', 
        Key: {
            id: {
                N: player_id.toString()
            },
            id_game: {
                S: id_game.toString()
            }
        }
    }; 

    return await db 
        .getItem(params)
        .promise()
        .then((res) => {
            var result = res.Item.pos.N;
            return result;
        }).catch((err) => {
            console.log('Unable to get player position. Error : ', err); 
            return false; 
        })
};

const updatePlayerPosition = async function(id_game, player_id, position) {
    let params = {
        TableName: 'players', 
        Key: {
            id: {
                N: player_id.toString()
            },
            id_game: {
                S: id_game.toString()
            }
        },
        UpdateExpression: "set pos = :x", 
        ExpressionAttributeValues: {
            ":x": {
                N: position.toString()
            }
        }
    };


    return await db 
        .updateItem(params)
        .promise()
        .then((res) => {
            return true; 
        }).catch((err) => {
            console.log('Unable to update player position. ERROR: ', err); 
            return false; 
        })
}

const getLostTurn = async function(id_game, player_id){
    let params = { 
        TableName: 'players', 
        Key: {
            id: {
                N: player_id.toString()
            },
            id_game: {
                S: id_game.toString()
            }
        }
    };

    return await db 
        .getItem(params) 
        .promise() 
        .then((res) => {
            var result = res.Item.lost_turn.BOOL;
            return result;
        }).catch((err) => {
            console.log('Unable to get lost_turn. Error: ', err); 
            return false; 
        })
}

const updateLostTurn = async function(id_game,player_id, value){
    let params = {
        TableName: 'players', 
        Key: {
            id: {
                N: player_id.toString()
            }, 
            id_game: {
                S: id_game.toString()
            }
        },
        UpdateExpression: "set lost_turn = :x",
        ExpressionAttributeValues: {
            ":x" : {
                BOOL: value
            }
        }
    };

    return await db 
        .updateItem(params) 
        .promise()
        .then((res) => {
            return true; 
        }).catch((err) => {
            console.log('Unable to update lost_turn. Error: ', err); 
            return false; 
        })

}

const getStamps = async function(id_game, id, stamp,table = 'players' ){
    let params = ""; 
    if(table == 'players'){
        params = {
            TableName: table.toString(), 
            Key: {
                id: {
                    N: id.toString()
                },
                id_game: {
                    S: id_game.toString()
                }
            }
        };
    }else{
        params = {
            TableName: table.toString(), 
            Key: {
                id: {
                    N: id.toString()
                },
            }
        };
    }
    

    return await db 
        .getItem(params)
        .promise()
        .then((res) => {
            switch(stamp.toString()){
                case "árbol": 
                    var result = res.Item.stamp_tree.N;
                    break; 
                case "bicicleta": 
                    var result = res.Item.stamp_bike.N; 
                    break;                 
                case "planeta": 
                    var result = res.Item.stamp_planet.N;
                    break;                 
                case "basura": 
                    var result = res.Item.stamp_trash.N;
                    break;                 
                case "gota": 
                    var result = res.Item.stamp_drop.N;
                    break;                
                case "reciclaje":
                    var result = res.Item.stamp_recycle.N; 
                    break;                 
                case "bombilla": 
                    var result = res.Item.stamp_lightbulb.N;
                    break;   
            }
            return result;
        }).catch((err) => {
            console.log('Unable to get stamps. Error: '+err); 
            return false; 
        })
}

const updateStamps = async function(id_game, player_id, stamp, total_stamps){
    switch(stamp.toString()){
        case "árbol": 
            var update_expression = "set stamp_tree  = :x";
            break; 
        case "bicicleta": 
            var update_expression = "set stamp_bike  = :x";
            break;                 
        case "planeta": 
            var update_expression = "set stamp_planet = :x";
            break;                 
        case "basura": 
            var update_expression = "set stamp_trash = :x";
            break;                 
        case "gota": 
            var update_expression = "set stamp_drop = :x";
            break;                
        case "reciclaje":
            var update_expression = "set stamp_recycle = :x"; 
            break;                 
        case "bombilla": 
            var update_expression = "set stamp_lightbulb = :x";
            break;   
    }

    let params = {
        TableName: 'players', 
        Key: {
            id: {
                N: player_id.toString()
            }, 
            id_game: {
                S: id_game.toString()
            }
        }, 
        UpdateExpression: `${update_expression}`, 
        ExpressionAttributeValues: {
            ":x": {
                N: total_stamps.toString()
            }
        }
    }

    return await db 
        .updateItem(params)
        .promise()
        .then((res) => {
            return true; 
        }).catch((err) => {
            console.log('Unable to update stamps. ERROR: ', err); 
            return false; 
        })
}

const getDiceResult = async function(game_id){
    let params = {
        TableName: 'game_data', 
        Key: {
            game_code: {
                S: game_id.toString()
            }
        }
    };

    return await db 
        .getItem(params) 
        .promise()
        .then((res) => {
            var result = res.Item.dice.S;
            return result; 
        }).catch((err) => {
            console.log('Unable to get dice result. Error : ', err);
            return false; 
        })
}

const getActualTurn = async function(game_id){
    let params = {
        TableName: 'game_data', 
        Key: {
            game_code: {
                S: game_id.toString()
            }
        }
    }

    return await db 
        .getItem(params) 
        .promise()
        .then((res) => {
            var result = res.Item.actual_turn.S;
            return result; 
        }).catch((err) => {
            console.log('Unable to get actual_turn. Error: ', err); 
            return false; 
        })
}

const updateActualTurn = async function(game_id, player_name){
    let params = {
        TableName: 'game_data', 
        Key: {
            game_code: {
                S: game_id.toString()
            }
        }, 
        UpdateExpression: "set actual_turn = :x", 
        ExpressionAttributeValues: {
            ":x": {
                S: player_name.toString()
            }
        }
    }

    return await db 
        .updateItem(params) 
        .promise() 
        .then((res) => {
            return true; 
        }).catch((err) => {
            console.log('Unable to update actual_turn. Error: ', err);
            return false; 
        });
}

const getSquare = async function(game_id){
    let params = {
        TableName: 'game_data',
        Key: {
            game_code:{
                S: game_id.toString()
            } 
        }
    }

    return await db 
        .getItem(params)
        .promise()
        .then((res) => {
            var result = res.Item.square.S;
            return result; 
        }).catch((err) => {
            console.log('Unable to get square. Error ', err); 
            return false; 
        })
}

const updateSquare = async function(game_id, square){
    let params = {
        TableName: 'game_data', 
        Key: {
            game_code: {
                S: game_id.toString()
            }
        },
        UpdateExpression: "set square = :x",
        ExpressionAttributeValues: {
            ":x" : {
                S: square
            }
        }
    };

    return await db 
        .updateItem(params) 
        .promise()
        .then((res) => {
            return true; 
        }).catch((err) => {
            console.log('Unable to update square. Error: ', err); 
            return false; 
        })
}


const getSquareType = async function(square_id){
    let params = {
        TableName: 'game_board',
        Key: {
            id_square:{
                N: square_id.toString()
            } 
        }
    }

    return await db 
        .getItem(params)
        .promise()
        .then((res) => {
            var type = res.Item.type_square.S;
            return type; 
        }).catch((err) => {
            console.log('Unable to get square type. Error ', err); 
            return false; 
        })
}
const getQuestionCode = async function(game_id){
    let params = {
        TableName: 'game_data', 
        Key: {
            game_code: {
                S: game_id.toString()
            }
        }
    };

    return await db 
        .getItem(params) 
        .promise()
        .then((res) => {
            var result = res.Item.question_code.S;
            return result; 
        }).catch((err) => {
            console.log('Unable to get question code. Error: ', err); 
            return false; 
        })
} 

const getQuestionType = async function(question_code){
    let params = {
        TableName: 'questions', 
        Key: {
            question_code: {
                S: question_code 
            }
        }
    };

    return await db 
        .getItem(params) 
        .promise()
        .then((res) => {
            var result = res.Item.question_type.S;
            return result; 
        }).catch((err) => {
            console.log('Unable to get question type. Error: ', err); 
            return false; 
        })
} 

const getQuestionStamp = async function(question_code){
    let params = {
        TableName: 'questions',
        Key: {
            question_code: {
                S: question_code
            }
        }
    };

    return await db
        .getItem(params)
        .promise()
        .then((res) => {
            var result = res.Item.question_stamp.S;
            return result;
        }).catch((err) => {
            console.log('Unable to get question stamp. Error: ', err);
            return false;
        })
}

const getSelectedAnswer = async function(game_id){
    let params = {
        TableName: 'game_data', 
        Key: {
            game_code: {
                S: game_id.toString()
            }
        }
    };

    return await db 
        .getItem(params) 
        .promise()
        .then((res) => {
            var result = res.Item.selected_answer.S;
            return result; 
        }).catch((err) => {
            console.log('Unable to get selected answer. Error: ', err); 
            return false; 
        })
} 

const updateSelectedAnswer = async function(game_id, answer){
    let params = {
        TableName: 'game_data',
        Key: {
            game_code: {
                S: game_id.toString()
            }
        },
        UpdateExpression: "set selected_answer = :x",
        ExpressionAttributeValues: {
            ":x" : {
                S: answer
            }
        }
    };

    return await db 
        .updateItem(params)
        .promise()
        .then((res) => {
            return true;
        }).catch((err) => {
            console.log('Unable to update selected answer. Error: ', err);
        })
}

const getMissionCard = async function(game_id){
    let params = {
        TableName: 'game_data', 
        Key: {
            game_code: {
                S: game_id.toString()
            }
        }
    };
    return await db 
        .getItem(params) 
        .promise()
        .then((res) => {
            var result = res.Item.mission_card.S;
            console.log(res.Item);
            return result; 
        }).catch((err) => {
            console.log('Unable to get mission card. Error: ', err); 
            return false; 
        })
}

const clearDiceValue = async function(game_id){
    let params = {
        TableName: 'game_data',
        Key: {
            game_code: {
                S: game_id.toString()
            }
        },
        UpdateExpression: "set dice = :x",
        ExpressionAttributeValues: {
            ":x" : {
               S: '-1'
            }
        }
    };
    return await db 
    .updateItem(params)
        .promise()
        .then((res) => {
            return true;
        }).catch((err) => {
            console.log('Unable to clear dice value. Error: ', err);
        })
}

const clearQuestionCode = async function(game_id){
    let params = {
        TableName: 'game_data',
        Key: {
            game_code: {
                S: game_id.toString()
            }
        },
        UpdateExpression: "set question_code = :x",
        ExpressionAttributeValues: {
            ":x" : {
               S: " "
            }
        }
    };
    return await db 
    .updateItem(params)
        .promise()
        .then((res) => {
            return true;
        }).catch((err) => {
            console.log('Unable to clear question code. Error: ', err);
        })
}

const getQuestionText = async function(question_code){
    let params = {
        TableName: 'questions',
        Key: {
            question_code: {
                S: question_code
            }
        }
    };
    return await db 
        .getItem(params) 
        .promise()
        .then((res) => {
            var result = res.Item.question_text.S;
            return result; 
        }).catch((err) => {
            console.log('QUESTOIN CODE', question_code);
            console.log('Unable to get question text. Error: ', err); 
            return false; 
        })
}

const getCorrectOption = async function(question_code){
    let params = {
        TableName: 'questions',
        Key: {
            question_code: {
                S: question_code
            }
        }
    };
    return await db
        .getItem(params)
        .promise()
        .then((res) =>{
            var result = res.Item.correct_option.S;
            return result;
        }).catch((err) => {
            console.log('Unable to get correct option', err);
            return false;
        })
}

const getCorrectOptionText = async function(question_code,correct_option){
    
    let params = {
        TableName: 'questions', 
        Key: {
            question_code: {
                S: question_code
            }
        }
    };

    let result_expression = "";

    return await db
        .getItem(params)
        .promise()
        .then((res) =>{
            switch(correct_option){
                case "A":
                    result_expression = res.Item.option_A.S;
                    break;
                case "B":
                    result_expression = res.Item.option_B.S;
                    break;
                case "C":
                    result_expression = res.Item.option_C.S;
                    break;
            }
            var result = result_expression;
            return result;
        }).catch((err) => {
            console.log(correct_option);
            console.log(result_expression);
            console.log('Unable to get correct option text', err);
            return false;
        })
}

const getAllOptions = async function(question_code){
    let params = {
        TableName: 'questions',
        Key: {
            question_code: {
                S: question_code
            }
        }
    };
    return await db
        .getItem(params)
        .promise()
        .then((res) => {
            var option_A = 'A) ' + res.Item.option_A.S;
            var option_B = 'B) ' + res.Item.option_B.S;
            var option_C = 'C) ' + res.Item.option_C.S;
            var all_options = option_A + ' ' + option_B + ' ' + option_C;
            return all_options;
        }).catch((err) => {
            console.log('Unable to get all options', err);
        })
}

const recoverPlayer = async function(id_game, player_id){
    let params = {
        TableName: 'players',
        Key: {
            id: {
                N: player_id.toString()
            },
            id_game: {
                S: id_game.toString()
            }
        }
    };

    return await db 
        .getItem(params)
        .promise()
        .then((res) => {
            var player_description = 'El ' + res.Item.name.S + ' se encuentra en la casilla ' + res.Item.pos.N + ' ';
            return player_description;
        }).catch((err) =>{
            console.log('Unable to recover player', err);
            return false;
        });
}

module.exports = {
    createGame,
    finishGame,
    deletePlayer, 
    deleteSession,
    getNumPlayers,
    updateNumPlayers,
    registerPlayer,
    getPlayerName,
    getPlayerPosition,
    updatePlayerPosition, 
    getStamps,
    updateStamps,
    getDiceResult,
    getActualTurn,
    updateActualTurn,
    getSquare,
    updateSquare,
    getQuestionCode,
    clearQuestionCode,
    getQuestionType,
    getQuestionStamp,
    getSelectedAnswer, 
    updateSelectedAnswer,
    getLostTurn,
    updateLostTurn,
    getMissionCard,
    getSquareType,
    clearDiceValue,
    getQuestionText,
    getCorrectOption,
    getCorrectOptionText,
    getAllOptions,
    recoverPlayer,
    checkGameExists,
    createUserSession,
    getGameCode,
};