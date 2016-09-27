var express = require('express');
var request = require('request');
var mongodb = require('mongodb').MongoClient;

var app = express();
app.use(express.static(__dirname + '/public'));

app.get('/api/imagesearch/:searchstring', function (req, res) {
	res.setHeader('Content-Type', 'application/json');
	var searchstring = req.params.searchstring;
	var searchoffset = Number(req.query.offset);
    var urlDB = process.env.MONGOLAB_URI;
    var jsonRes = {};
    var bingURL = "https://api.datamarket.azure.com/Bing/Search/v1/Image?Query='"+searchstring+"'&$format=json";
    if (searchoffset){
    	bingURL += "&$skip="+String(50*searchoffset);
    }

    request.get(bingURL, {
		'auth': {
		'user': process.env.BING_ACCOUNT,
		'pass': process.env.BING_ACCOUNT,
		'sendImmediately': false
		}
	}, function(error,response,data){
		if (error){
			console.error("AJAX error: "+error);
			res.end(JSON.stringify({error:"BING API ERROR: "+error}));
		}
		else {
			var searchArr = JSON.parse(data).d.results;
    		var resArr = [];
    		for (var i = 0; i < searchArr.length; i++){
    			resArr.push({
    				"url": searchArr[i]["MediaUrl"],
					"snippet": searchArr[i]["Title"],
					"thumbnail": searchArr[i]["Thumbnail"]["MediaUrl"],
					"context": searchArr[i]["SourceUrl"]
    			});
    		}
    		res.end(JSON.stringify(resArr));
		}
	});


	mongodb.connect(urlDB, function (err, db) {
		if (err) {
			console.log('Unable to connect to the mongoDB server. Error:'+err);
			db.close();
			return;
		}
		else {
			var collection = db.collection("image_search");

			collection.find({}).toArray(function(err, docs) {
			    if (err){
			    	console.log("Collection.find ERROR: "+err);
			    	db.close();
			    	return;
			    }

		    	if (docs.length < 10){
		    		collection.insertOne({term:searchstring, when:Date.now()},function(err){
		    			if (err){
		    				console.error(err);
		    				db.close();
		    				return;
		    			}
		    		});
		    	}
		    	else {
		    		docs.sort(function(a, b) {
						return a.when - b.when;
					});
			    	collection.findOneAndUpdate(
			    		{_id:docs[0]._id},
			    		{term:searchstring, when:Date.now()}
			    	);
			    	db.close();
			    	return;
		    	}
		    });
		}
	});

});

app.get('/api/latest/imagesearch',function(req,res){
	var urlDB = process.env.MONGOLAB_URI;
	mongodb.connect(urlDB, function (err, db) {
		if (err) {
			console.log('Unable to connect to the mongoDB server. Error:'+err);
			db.close();
			return;
		}
		else {
			var collection = db.collection("image_search");

			collection.find({},{_id:false}).toArray(function(err, docs) {
			    if (err){
			    	console.log("Collection.find ERROR: "+err);
			    	db.close();
			    	return;
			    }

		    	res.end(JSON.stringify(docs));
		    	db.close();
		    });
		}
	});
});

app.get('/',function(req,res){
	res.sendFile('index.html');
});

app.listen(process.env.PORT || 8080, function () {
	console.log('Image Search Abstraction Layer listening on port '+process.env.PORT||8080+'!');
});

