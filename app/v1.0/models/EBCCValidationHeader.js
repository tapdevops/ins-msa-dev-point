/*
 |--------------------------------------------------------------------------
 | Variable
 |--------------------------------------------------------------------------
 */
const Mongoose = require('mongoose');
const SchemaTypes = Mongoose.Schema.Types;

require('mongoose-double')(Mongoose);
const db = require(_directory_base + '/config/database.js');
const connectEbcc = Mongoose.createConnection(db.ebccval[config.app.env].url, {useNewUrlParser: true, useUnifiedTopology: true});
/*
 |--------------------------------------------------------------------------
 | Schema
 |--------------------------------------------------------------------------
 */
const EBCCValidationHeaderSchema = Mongoose.Schema({
	EBCC_VALIDATION_CODE: String,
	WERKS: String,
	AFD_CODE: String,
	BLOCK_CODE: String,
	NO_TPH: String,
	STATUS_TPH_SCAN: String,
	ALASAN_MANUAL: String,
	LAT_TPH: SchemaTypes.Double,
	LON_TPH: SchemaTypes.Double,
	DELIVERY_CODE: String,
	STATUS_DELIVERY_CODE: String,
	STATUS_SYNC: String,
	SYNC_TIME: {
		type: Number,
		get: v => Math.floor(v),
		set: v => Math.floor(v),
		alias: 'i',
		default: function () {
			return 0;
		}
	},
	INSERT_USER: String,
	INSERT_TIME: {
		type: Number,
		get: v => Math.floor(v),
		set: v => Math.floor(v),
		alias: 'i',
		default: function () {
			return 0;
		}
	},
	UPDATE_USER: String,
	UPDATE_TIME: {
		type: Number,
		get: v => Math.floor(v),
		set: v => Math.floor(v),
		alias: 'i',
		default: function () {
			return 0;
		}
	}
});

/*
 |--------------------------------------------------------------------------
 | Module Exports
 |--------------------------------------------------------------------------
 */
module.exports = connectEbcc.model('EBCCValidationHeader', EBCCValidationHeaderSchema, 'TR_H_EBCC_VALIDATION');