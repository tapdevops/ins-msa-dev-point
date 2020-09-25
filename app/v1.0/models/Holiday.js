/*
 |--------------------------------------------------------------------------
 | Models - Parameter
 |--------------------------------------------------------------------------
 */
const Mongoose = require('mongoose');
const ZpomHL = Mongoose.Schema({
	WERKS: String,
	LGORT: String,
	HOLIDAY_DATE: {
		type: Number,
		get: v => Math.floor(v),
		set: v => Math.floor(v),
		alias: 'i',
		default: function () {
			return 0;
		}
	},
	COUNTRY: Number,
	TYPE: String,
	HBSR: String,
	HOLIDAY_DESCRIPTION: String,
	CREATED_BY: String,
	CREATED_DATE: {
		type: Number,
		get: v => Math.floor(v),
		set: v => Math.floor(v),
		alias: 'i',
		default: function () {
			return 0;
		}
	},
	UPDATED_BY: String,
	UPDATED_DATE: {
		type: Number,
		get: v => Math.floor(v),
		set: v => Math.floor(v),
		alias: 'i',
		default: function () {
			return 0;
		}
	},
	INSERT_STAGING: {
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
 | Exports
 |--------------------------------------------------------------------------
 */
module.exports = Mongoose.model('Holiday_v_2_1', ZpomHL, 'TM_HOLIDAY');