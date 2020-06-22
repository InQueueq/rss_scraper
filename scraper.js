const mongoose = require('mongoose')
mongoose.connect('mongodb://localhost:27017/rss',{useNewUrlParser:true,useUnifiedTopology: true},);
const Parser = require("rss-parser");
const CronJob = require('cron').CronJob;
const Article = require('./articles')
const express = require('express')
const app = express()
const PORT = 5000 || process.env.PORT;
const paginationLimit = 20;

// Call it once in constant N mins
// Save posts to MongoDB
// API gets 20 posts from DB
//

app.get('/articles',paginatedResults(Article),(req, res)=>{
    res.json(res.paginatedResults);
})

function paginatedResults(model){
    return async(req, res, next)=>{
        const page = parseInt(req.query.page);
        const startIndex = (page - 1) * paginationLimit;
        const endIndex = page * paginationLimit;
        const ceilIndex = await mongoose.connection.db.collection('articles').countDocuments();
        const results = {};
        if(endIndex < ceilIndex){
            results.next = {
                page: page + 1,
                limit: paginationLimit
            }
        }
        if(startIndex > 0){
            results.previous = {
                page: page - 1,
                limit:paginationLimit
            }
        }
        try{
            results.results = await model.find().limit(paginationLimit).skip(startIndex).exec()
            res.paginatedResults = results;
            next()
        }
        catch (e) {
            res.status(500).json({message:e.message})
        }
    }
}
const job = new CronJob({
    cronTime: '0 */5 * * * *',
    onTick: async function() {
        const parser = new Parser();
        const articles = mongoose.connection.db.collection('articles')
        const feed = await parser.parseURL("https://news.ycombinator.com/rss");
        feed.items.map(currentItem => {
            articles.find({title:currentItem.title}).count().then(count=>{
                if(count <= 0){
                    const article = new Article(currentItem);
                    article.save()
                            .then(item => {console.log("item saved to database");
                            })
                            .catch(err=>{console.log(err);
                            });
                }
            }).catch(err=>{
                console.log(err);
            });
        });
    }
});

mongoose.connection.on('open',function(err,db) {
    job.start();
});

app.listen(PORT, ()=> console.log(`Server started on ${PORT} port`));