import { createClient } from 'redis';
import axios from 'axios';

const client = createClient();

client.on('error', (err) => console.log('Redis Client Error', err));

await client.connect();

/*
 *	Manejo de fecha
 */
Object.defineProperty(Date.prototype, "timestamp", {
  value: function () {
    function pad2(n) {
      // always returns a string
      return (n < 10 ? "0" : "") + n;
    }

    return (
      this.getFullYear() +
      pad2(this.getMonth() + 1) +
      pad2(this.getDate()) +
      pad2(this.getHours()) +
      pad2(this.getMinutes()) +
      pad2(this.getSeconds())
    );
  },
});

/*
 *	Dominio
 */

const updater = () => {
  getBody(LaNacion, new Rate());
};

class Rate {
	constructor(){
		this.date;
		this.value = 0;
		this.source = "";
	}
	evaluate = (anotherValue) => {
		if (anotherValue.length == 0) {
		  console.log("First Persist");
		  persist(this);
		} else if (JSON.parse(anotherValue).value != this.value) {
		  console.log("New Value to persist!");
		  persist(this);
		} else {
		  console.log("Nothing to persist");
		}
		console.log("this", this);
	  }
}

updater();

/*
 *	Funciones de parseo URL
 */
function getBody(parser, remoteRate) {
  	var parser = new parser();
	axios.get(parser.url)
	.then( (body) => {
		remoteRate.date = new Date().timestamp();
		parser.parse(body.data, remoteRate);
		console.log("Valor leido de", remoteRate.source, remoteRate.value);
		readLastValue(remoteRate);
	  })
	  .catch( (error) => {
		console.log(error);
	  })
}
function Parser() {
  this.url = "";
  this.json = "";
  this.sourceName = "";
  this.jsonValue = "";
}
Parser.prototype.parse = function (body, result) {
  this.json = JSON.parse(body);
  result.source = this.sourceName;
  result.value = this.jsonValue;
};

function BlueLitics() {
  Parser.call(this);
  this.url = "http://api.bluelytics.com.ar/v2/latest";
  this.sourceName = "BlueLytics";
  this.jsonValue = this.json.oficial.value_buy;
}

function GeekLab() {
  Parser.call(this);
  this.url = "http://ws.geeklab.com.ar/dolar/get-dolar-json.php";
  this.sourceName = "GeekLab";
  this.jsonValue = this.json.libre;
}

function LaNacion() {
  Parser.call(this);
  this.url = "http://contenidos.lanacion.com.ar/json/dolar";
  this.sourceName = "La Nacion";
}
LaNacion.prototype.parse = function (body, result) {
	this.json = JSON.parse(body.substring(19, body.length - 2));
  	console.log("json es " + this.json)
  	result.source = this.sourceName;
  	result.value = this.json.CasaCambioVentaValue.replace(",", ".");
};

/*
 *	Funciones Redis
 */

async function persist(value) {
	try {
		await client.lPush("dolar",JSON.stringify(value))
		console.log("Valor grabado ", value);
	}
	catch (error) {
		console.log(error)
	}
}

async function readLastValue(remoteRate) {
	try {
		const messages = await client.lRange("dolar",0,0);
		console.log("Valor leido de Redis ", messages);
		remoteRate.evaluate(messages);
		process.exit(0)
	}
	catch (error) {
		console.log(error)
		process.exit(1)
	}
}