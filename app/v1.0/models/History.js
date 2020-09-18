const mongoose = require( 'mongoose' );
require( 'mongoose-double' )(mongoose);

const History = mongoose.Schema({
	USER_AUTH_CODE: String,
	PERIOD: {
		type: Number,
		get: v => Math.floor( v ),
		set: v => Math.floor( v ),
		alias: 'i',
		default: function() {
			return null;
		}
	},
    DATE: Date,
    BA_CODE: String,
    POINT: Number,
    TYPE: String,
    REMARKS: String,
    REFERENCE: String
});

module.exports = mongoose.model( 'History', History, 'TR_HISTORY' );