const mongoose = require('mongoose')
mongoose.connect('mongodb://localhost:27017/rss',{useNewUrlParser:true,useUnifiedTopology: true},);
const Parser = require("rss-parser");
const CronJob = require('cron').CronJob;
const Article = require('./articles')
const express = require('express')
const app = express()
const PORT = 5000 || process.env.PORT;
const paginationLimit = 20;
const TelegramBot = require('node-telegram-bot-api');
const TOKEN = '1181561733:AAE_yN_GOadfb7jZnBtlilO7RH04tx6jGNs';
const id = [];

const parser = new Parser();


const bot = new TelegramBot(TOKEN,{
    polling: true
})
bot.onText(/\/start/, function (msg, match) {
    id.push(msg.from.id);
    bot.sendMessage(msg.from.id,`Hello ${msg.from.first_name}, welcome!`);
});
// Call it once in constant N mins
// Save posts to MongoDB
// API paginates 20 posts from DB
//

app.get('/articles',async (req, res)=>{
    const results = {};
    const page = parseInt(req.query.page);
    const startIndex = (page - 1) * paginationLimit;
    results.results = await Article.find().limit(paginationLimit).skip(startIndex).exec();
    res.json(results);
})

const job = new CronJob({
    cronTime: '* */5 * * * *',
    onTick: async function() {
        const articles = mongoose.connection.db.collection('articles');
        const maxPublishingDate = await articles.find().count() <= 0 ? new Date(1991,11) : (await articles.find().sort({pubDate:-1}).limit(1).toArray())[0].pubDate;
        const feed = await parser.parseURL("https://news.ycombinator.com/rss");
        const filteredArticles = feed.items.filter(item=>new Date(item.pubDate) > maxPublishingDate);
        filteredArticles.map(item=>{
            id.forEach(userId=>{
                bot.sendMessage(userId,`New post is out! \n${item.title}\n${item.link}`)
            })
            const article = new Article(item);
            article.save()
                .then(item => {console.log("The item has been to database");
                })
                .catch(err=>{console.log(err);
                });
        })
    }
});
mongoose.connection.on('open',function(err,db) {
    job.start();
});

app.listen(PORT, ()=> console.log(`Server started on ${PORT} port`));
