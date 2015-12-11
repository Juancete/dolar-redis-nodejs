/*
*	Manejo de fecha
*/
Object.defineProperty(Date.prototype, 'timestamp', {
    value: function() {
        function pad2(n) {  // always returns a string
            return (n < 10 ? '0' : '') + n;
        }

        return this.getFullYear() +
               pad2(this.getMonth() + 1) + 
               pad2(this.getDate()) +
               pad2(this.getHours()) +
               pad2(this.getMinutes()) +
               pad2(this.getSeconds());
    }
});


/*
*	Dominio
*/
function Updater() {
	this.remoteRate = new Rate();
}

Updater.prototype.update = function(){
	getBody(LaNacion,this.remoteRate);
}

function Rate() {
	this.date;
	this.value = 0;
	this.source = "";
}

Rate.prototype.evaluate = function(anotherValue){
	if (anotherValue.length==0){
		console.log('First Persist');
		persist(this);
	}
	else if ((JSON.parse(anotherValue)).value != this.value){
		console.log('New Value to persist!');
		persist(this);
	}
	else {
		console.log('Nothing to persist');
	}
	console.log('this',this);
}

var updater = new Updater();
updater.update();

/*
*	Funciones de parseo URL
*/
function getBody(parser,remoteRate){
	var parser = new parser();
	require('request').get(parser.url, function (error, response, body) {
	    if (!error && response.statusCode == 200) {
	    	remoteRate.date = (new Date).timestamp();
	        parser.parse(body,remoteRate);
	        console.log('Valor leido de',remoteRate.source,remoteRate.value);
	        readLastValue(remoteRate); 
	    }
	});	
}
function Parser(){
	this.url="";
	this.json="";
	this.sourceName="";
	this.jsonValue="";

}
Parser.prototype.parse = function(body,result){
	this.json = JSON.parse(body);
	result.source = this.sourceName;
	result.value = this.jsonValue;
}


function BlueLitics(){
	Parser.call(this);
	this.url = "http://api.bluelytics.com.ar/v2/latest";
	this.sourceName = "BlueLytics";
	this.jsonValue = this.json.oficial.value_buy;
}

function GeekLab(){
	Parser.call(this);
	this.url = "http://ws.geeklab.com.ar/dolar/get-dolar-json.php";
	this.sourceName = "GeekLab";
	this.jsonValue = this.json.libre;
}

function LaNacion(){
	Parser.call(this);
	this.url = "http://contenidos.lanacion.com.ar/json/dolar";
	this.sourceName = "La Nacion";
}
LaNacion.prototype.parse = function(body,result){
	this.json = JSON.parse(body.substring(19,body.length - 2));
	result.source = this.sourceName;
	result.value = this.json.CasaCambioVentaValue.replace(",",".");
}

/*
*	Funciones Redis
*/
function persist(value){
	executeRedis( function (client){
		client.lpush('dolar', JSON.stringify(value), function(err, reply){ 
			console.log('Valor grabado ',value,reply); 
		});
	});
}

function readLastValue(remoteRate){
	executeRedis( function (client){
		client.lrange("dolar",0,0, function(err, messages){ 
			if (!err){
				console.log('Valor leido de Redis',messages)
				remoteRate.evaluate(messages);
			}
		});
	});	
}

function executeRedis(aFunction){
	var client = require('redis').createClient(6379, 'localhost', {no_ready_check: true,max_attempts:3});
	client.on('connect', function() {
	    //console.log('Connected to Redis');
	    aFunction(client);
	    client.quit();
	});
	client.on("error", function (err) {
	    console.log("Error " + err);
	});
	
}