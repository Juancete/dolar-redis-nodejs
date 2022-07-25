import { createClient } from "redis"
import { DateTime } from "luxon"
import axios from "axios"

const client = createClient()
client.on("error", (err) => {
	console.log("Redis Client Error", err)
	process.exit(1)
})
await client.connect();

/*
 *	Dominio
 */
const getValue = (item, property) =>
	property
		.split(".")
		.reduce((previousValue, currentValue) => previousValue[currentValue], item)

class Parser {
	constructor(url = "", sourceName = "", jsonValue = "") {
		this.url = url
		this.json = ""
		this.sourceName = sourceName
		this.jsonValue = jsonValue
	}
	parse = (body, result) => {
		this.json = body //JSON.parse(body);
		result.source = this.sourceName
		result.value = getValue(this.json, this.jsonValue)
	}
}

class LaNacion extends Parser {
	parse = (body, result) => {
		const cuerpo = body.substring(19, body.length - 2)
		// console.log("parseando body " + JSON.stringify(cuerpo))
		this.json = JSON.parse(cuerpo)
		result.source = this.sourceName
		result.value = this.json.CasaCambioVentaValue.replace(",", ".")
	}
}

const ambitoOficial = new Parser (
  "https://mercados.ambito.com/dolar/oficial/variacion",
  "Ambito Financiero",
  "venta"
)

const ambitoInformal = new Parser (
  "https://mercados.ambito.com/dolar/informal/variacion",
  "Ambito Financiero",
  "venta"
)

const blueLitics = new Parser(
	"http://api.bluelytics.com.ar/v2/latest",
	"BlueLytics",
	"oficial.value_sell"
)

const geekLab = new Parser(
	"http://ws.geeklab.com.ar/dolar/get-dolar-json.php",
	"GeekLab",
	"libre"
)

const laNacion = new LaNacion(
	"http://contenidos.lanacion.com.ar/json/dolar",
	"La Nación"
)

const updater = async () => {
	await getBody(ambitoOficial,"dolar")
  await getBody(ambitoInformal,"blue")
  process.exit(0)
}

class Rate {
	constructor() {
		this.date
		this.value = 0
		this.source = ""
	}
	evaluate = async (anotherValue, type) => {
		if (anotherValue.length == 0) {
			console.log("First Persist")
			await persist(this, type)
		} else if (JSON.parse(anotherValue).value != this.value) {
			console.log("New Value to persist!")
			await persist(this, type)
		} else {
			console.log("Nothing to persist")
		}
	}
}

updater()

/*
 *	Funciones de parseo URL
 */
async function getBody(parser,type) {
	//   var parser = new parser();
  const remoteRate = new Rate()
	console.log("buscando de página " + parser.url)
	await axios
		.get(parser.url)
		.then(async (body) => {
			remoteRate.date = DateTime.utc().toISO()
			parser.parse(body.data, remoteRate)
			console.log("Valor leido de", remoteRate.source, remoteRate.value)
			await readLastValue(remoteRate, type)
		})
		.catch((error) => {
			console.log(error)
			process.exit(1)
		})
}

/*
 *	Funciones Redis
 */

async function persist(value, type) {
	try {
		const largo = await client.lLen(type)
		if (largo > 5) await client.rPop(type)
		await client.lPush(type, JSON.stringify(value))
		console.log("Valor grabado ", value)
	} catch (error) {
		console.log(error)
    process.exit(1)
	}
}

async function readLastValue(remoteRate, type) {
	try {
		const messages = await client.lRange(type, 0, 0)
		console.log("Valor leido de Redis ", messages)
		await remoteRate.evaluate(messages,type)
	} catch (error) {
		console.log(error)
		process.exit(1)
	}
}
