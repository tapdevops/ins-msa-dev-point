/*
|--------------------------------------------------------------------------
| Variable
|--------------------------------------------------------------------------
*/
const kafka = require( 'kafka-node' );
const dateformat = require('dateformat');
const moment = require( 'moment-timezone');

//Models
const Models = {
    Point: require( _directory_base + '/app/v1.0/models/Point.js'),
    KafkaPayload: require( _directory_base + '/app/v1.0/models/KafkaPayload.js'),
    ViewUserAuth: require( _directory_base + '/app/v1.0/models/ViewUserAuth.js'),
    InspectionH: require( _directory_base + '/app/v1.0/models/InspectionH.js'),
}
/*
|--------------------------------------------------------------------------
| Kafka Server Library
|--------------------------------------------------------------------------
|
| Apache Kafka is an open-source stream-processing software platform 
| developed by LinkedIn and donated to the Apache Software Foundation, 
| written in Scala and Java. The project aims to provide a unified, 
| high-throughput, low-latency platform for handling real-time data feeds.
|
*/
class Kafka {
    async consumer () {
        const Consumer = kafka.Consumer;
        const Offset = kafka.Offset;
        const Client = kafka.KafkaClient;
        const client = new Client({ kafkaHost: config.app.kafka[config.app.env].server_host });
        
        let offsets = await this.getListOffset();
        const topics = [
            { topic: 'INS_MSA_FINDING_TR_FINDING', partition: 0, offset: offsets['INS_MSA_FINDING_TR_FINDING'] },
            { topic: 'INS_MSA_INS_TR_BLOCK_INSPECTION_H', partition: 0, offset: offsets['INS_MSA_INS_TR_BLOCK_INSPECTION_H'] },
            // { topic: 'INS_MSA_INS_TR_BLOCK_INSPECTION_D', partition: 0, offset: offsets['INS_MSA_INS_TR_BLOCK_INSPECTION_D'] },
            { topic: 'INS_MSA_INS_TR_INSPECTION_GENBA', partition: 0, offset: offsets['INS_MSA_INS_TR_INSPECTION_GENBA'] },
            { topic: 'INS_MSA_EBCCVAL_TR_EBCC_VALIDATION_H', partition: 0, offset: offsets['INS_MSA_EBCCVAL_TR_EBCC_VALIDATION_H'] }
        ];
        const options = {
            autoCommit: false,
            fetchMaxWaitMs: 1000,
            fetchMaxBytes: 1024 * 1024,
            fromOffset: true,
            requestTimeout: 5000
        };

        const consumer = new Consumer(client, topics, options);
        let offset = new Offset(client);
        consumer.on( 'message', async ( message ) => {
            if (message) {
                if (message.topic && message.value) {
                    try {
                        this.save(message, offset);
                    } catch (err) {
                        console.log(err);
                    }
                }
            }
        })
        consumer.on( 'error', function( err ) {
            console.log( 'error', err );
        });
        consumer.on('offsetOutOfRange', function (topic) {
            topic.maxNum = 2;
            offset.fetch([topic], function (err, offsets) {
                if (err) {
                    return console.error(err);
                }
                var min = Math.min.apply(null, offsets[topic.topic][topic.partition]);
                consumer.setOffset(topic.topic, topic.partition, min);
            });
        });
        
    }
    async save(message, offsetFetch) {
        try {
            let now = moment(new Date()).tz('Asia/Jakarta')
            let endOfMonth = new Date(now.year(), now.month() + 1, 0);
            let dateNumber = parseInt(dateformat(endOfMonth, 'yyyymmdd')); //misalnya 20203101
            let data = JSON.parse(message.value);
            let topic = message.topic;
            let inspectionDate = parseInt(moment( new Date() ).tz( "Asia/Jakarta" ).format( "YYYYMMDDHHmmss" ));
            let werks = data.WERKS;
            
            if (topic === 'INS_MSA_FINDING_TR_FINDING') {

                //jika finding sudah selesai, maka lakukan perhitungan point
                if (data.END_TIME != "" && data.RTGVL == 0) {
                    let endTimeNumber = parseInt(data.END_TIME.substring(0, 8));
                    let dueDate = parseInt(data.DUE_DATE.substring(0, 8));
                    //jika finding sudah diselesaikan dan tidak overdue dapat 5 point ,
                    // jika overdue maka user yang menyelasaikan finding tidak mendapatkan tambahan point
                    if (endTimeNumber <= dueDate) {
                        this.updatePoint(data.UPTUR, 5, dateNumber, null, werks);
                    }
                    
                    //update point user yang membuat finding
                    this.updatePoint(data.INSUR, 2, dateNumber, null, werks);
                    //memberi tambahan point sesuai rating yang diberikan
                    
                } else if (data.END_TIME != "" && data.RTGVL != 0) {
                    let ratings = [1, 2, 3, 4];
                    for (let i = 0; i < ratings.length; i++) {
                        if (data.RTGVL == ratings[i]) {
                            this.updatePoint(data.UPTUR, ratings[i] - 2, dateNumber, null, werks);
                            break;
                        }
                    }
                } 
                this.updateOffset(topic, offsetFetch);
            } else if (topic === 'INS_MSA_INS_TR_BLOCK_INSPECTION_H') {
                this.updateOffset(topic, offsetFetch);
                this.updatePoint(data.INSUR, 1, dateNumber, inspectionDate, werks);
            } else if (topic === 'INS_MSA_INS_TR_INSPECTION_GENBA') {
                let inspection = await Models.InspectionH.findOne({BLOCK_INSPECTION_CODE: data.BINCH}).select({_id: 0, WERKS: 1});
                let werksGenba = inspection.WERKS;
                this.updatePoint(data.GNBUR, 1, dateNumber, inspectionDate, werksGenba);
                this.updateOffset(topic, offsetFetch);
            } else if (topic === 'INS_MSA_EBCCVAL_TR_EBCC_VALIDATION_H') {
                this.updatePoint(data.INSUR, 1, dateNumber, inspectionDate, werks);
                this.updateOffset(topic, offsetFetch);
            }
        } catch (err) {
            console.log(err);
        }
    }

    //tambahkan point user
    async updatePoint(userAuthCode, point, dateNumber, inspectionDate = 0, werks) {
        console.log(werks);
        let set = new Models.Point({
            USER_AUTH_CODE: userAuthCode, 
            LOCATION_CODE: werks,
            MONTH: dateNumber,
            POINT: point,
            LAST_INSPECTION_DATE: inspectionDate
        });
        // console.log(set);
        await set.save()
        .then(data => {
            console.log('berhasil save');
        })
        .catch(err => {
            if (inspectionDate != 0) {
                Models.Point.updateOne({
                    USER_AUTH_CODE: userAuthCode,
                    LOCATION_CODE: werks,
                    MONTH: dateNumber,
                }, {
                    LAST_INSPECTION_DATE: inspectionDate,
                    $inc: {
                        POINT: point
                    }
                })
                .then( () => {
                    console.log("sukses update", userAuthCode)
                })
                .catch(err => {
                    console.log(err);
                });
            } else {
                Models.Point.updateOne({
                    USER_AUTH_CODE: userAuthCode,
                    MONTH: dateNumber,
                    LOCATION_CODE: werks,
                }, {
                    $inc: {
                        POINT: point
                    }
                })  
                .then( (data) => {
                    console.log("sukses update", userAuthCode)
                })
                .catch(err => {
                    console.log(err);
                });
            }
        });
    }
    
    //untuk mendapatkan semua offset dari setiap topic
    async getListOffset() {
        try {
            let data = await Models.KafkaPayload.find({});
            let mapped = data.map(item => ({ [item.TOPIC]: item.OFFSET }) );
            let dataObject = Object.assign({}, ...mapped );
             
            return dataObject;
        } catch (err) {
            console.log(err);
            return null;
        }
    }
    
    //update offset dari satu topic
    updateOffset(topic, offsetFetch) {
        try {
            offsetFetch.fetch([
                { topic: topic, partition: 0, time: -1, maxNum: 1 }
            ], function (err, data) {
                let lastOffsetNumber = data[topic]['0'][0];
                console.log(topic);
                console.log(lastOffsetNumber);
                Models.KafkaPayload.findOneAndUpdate({
                    TOPIC: topic
                }, {
                    OFFSET: lastOffsetNumber 
                }, {
                    new: true
                }).then(() => {
                    // console.log('sukses update offset');
                }).catch(err => {
                    console.log(err);
                });
            });
        } catch (err) {
             console.log(err);
        }
    }
}


/*
|--------------------------------------------------------------------------
| Module Exports
|--------------------------------------------------------------------------
*/
module.exports = new Kafka();