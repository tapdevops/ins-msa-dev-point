/*
 |--------------------------------------------------------------------------
 | Variable
 |--------------------------------------------------------------------------
 */
const mongoose = require('mongoose');
const db = require(_directory_base + '/config/database.js');
const connectHS = mongoose.createConnection(db.hectareStatement[config.app.env].url, {useNewUrlParser: true, useUnifiedTopology: true});
/*
 |--------------------------------------------------------------------------
 | Schema
 |--------------------------------------------------------------------------
 */
const BlockSchema = mongoose.Schema({
	NATIONAL: String,
	REGION_CODE: String,
	COMP_CODE: String,
	EST_CODE: String,
	WERKS: String,
	JUMLAH_TPH: {
		type: Number,
		get: v => Math.floor(v),
		set: v => Math.floor(v),
		alias: 'i',
		default: function () {
			return null;
		}
	},
	AFD_CODE: String,
	BLOCK_CODE: String,
	BLOCK_NAME: String,
	WERKS_AFD_CODE: String,
	WERKS_AFD_BLOCK_CODE: String,
	LATITUDE_BLOCK: String,
	LONGITUDE_BLOCK: String,
	START_VALID: {
		type: Number,
		get: v => Math.floor(v),
		set: v => Math.floor(v),
		alias: 'i',
		default: function () {
			return null;
		}
	},
	END_VALID: {
		type: Number,
		get: v => Math.floor(v),
		set: v => Math.floor(v),
		alias: 'i',
		default: function () {
			return null;
		}
	},
	INSERT_TIME: {
		type: Number,
		get: v => Math.floor(v),
		set: v => Math.floor(v),
		alias: 'i',
		default: function () {
			return null;
		}
	},
	UPDATE_TIME: {
		type: Number,
		get: v => Math.floor(v),
		set: v => Math.floor(v),
		alias: 'i',
		default: function () {
			return null;
		}
	},
	DELETE_TIME: {
		type: Number,
		get: v => Math.floor(v),
		set: v => Math.floor(v),
		alias: 'i',
		default: function () {
			return null;
		}
	}
});

/*
|--------------------------------------------------------------------------
| Module Exports
|--------------------------------------------------------------------------
*/
module.exports = connectHS.model('Block', BlockSchema, 'TM_BLOCK');