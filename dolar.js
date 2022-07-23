import { createClient } from "redis";
import { DateTime } from "luxon";
import axios from "axios";

const client = createClient();
client.on("error", (err) => console.log("Redis Client Error", err));
await client.connect();

/*
 *	Dominio
 */
const getValue = (item, property) =>
  property
    .split(".")
    .reduce((previousValue, currentValue) => previousValue[currentValue], item);

class Parser {
  constructor(url = "", sourceName = "", jsonValue = "") {
    this.url = url;
    this.json = "";
    this.sourceName = sourceName;
    this.jsonValue = jsonValue;
  }
  parse = (body, result) => {
	console.log("parseando body " + JSON.stringify(body))
    this.json = body //JSON.parse(body);
    result.source = this.sourceName;
    result.value = getValue(this.json,this.jsonValue);
  };
}

class LaNacion extends Parser {
  parse = (body, result) => {
	const cuerpo = body.substring(19, body.length - 2)
	console.log("parseando body " + JSON.stringify(cuerpo))
    this.json = JSON.parse(cuerpo);
    result.source = this.sourceName;
    result.value = this.json.CasaCambioVentaValue.replace(",", ".");
  };
}
const blueLitics = new Parser(
  "http://api.bluelytics.com.ar/v2/latest",
  "BlueLytics",
  "oficial.value_sell"
);

const geekLab = new Parser(
  "http://ws.geeklab.com.ar/dolar/get-dolar-json.php",
  "GeekLab",
  "libre"
);

const laNacion = new LaNacion(
  "http://contenidos.lanacion.com.ar/json/dolar",
  "La Nación"
);

const updater = () => {
  getBody(laNacion, new Rate());
};

class Rate {
  constructor() {
    this.date;
    this.value = 0;
    this.source = "";
  }
  evaluate = async (anotherValue) => {
    if (anotherValue.length == 0) {
      console.log("First Persist");
      await persist(this);
    } else if (JSON.parse(anotherValue).value != this.value) {
      console.log("New Value to persist!");
      await persist(this);
    } else {
      console.log("Nothing to persist");
    }
  };
}

updater();

/*
 *	Funciones de parseo URL
 */
function getBody(parser, remoteRate) {
  //   var parser = new parser();
  console.log("buscando de página " + parser.url);
  axios
    .get(parser.url)
    .then((body) => {
      remoteRate.date = DateTime.utc().toISO();
      parser.parse(body.data, remoteRate);
      console.log("Valor leido de", remoteRate.source, remoteRate.value);
      readLastValue(remoteRate);
    })
    .catch((error) => {
      console.log(error);
    });
}

/*
 *	Funciones Redis
 */

async function persist(value) {
  try {
	const largo = await client.lLen("dolar")
	if (largo > 5)
		await client.rPop("dolar")
    await client.lPush("dolar", JSON.stringify(value));
    console.log("Valor grabado ", value);
  } catch (error) {
    console.log(error);
  }
}

async function readLastValue(remoteRate) {
  try {
    const messages = await client.lRange("dolar", 0, 0);
    console.log("Valor leido de Redis ", messages);
    await remoteRate.evaluate(messages);
    process.exit(0);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
}