import axios from 'axios';
import { config } from '../../core/config.js';

class TwitterService {
  constructor() {
    this.apiKey = config.apifyApiKey;
    this.baseUrl = 'https://api.apify.com/v2/acts/quacker~twitter-scraper/runs';
  }

  async searchTweets(cashtag) {
    try {
      const response = await axios.post(this.baseUrl, {
        startUrls: [{
          url: `https://twitter.com/search?q=%24${cashtag}&src=typed_query&f=live`
        }],
        maxItems: 100,
        addUserInfo: true,
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return this.formatTweets(response.data.items);
    } catch (error) {
      console.error('Error fetching tweets:', error);
      throw error;
    }
  }

  formatTweets(tweets) {
    return tweets.map(tweet => ({
      id: tweet.id,
      text: tweet.text,
      author: {
        username: tweet.author.userName,
        name: tweet.author.name,
        followers: tweet.author.followers,
        verified: tweet.author.isVerified
      },
      stats: {
        likes: tweet.likeCount,
        retweets: tweet.retweetCount,
        replies: tweet.replyCount,
        views: tweet.viewCount
      },
      createdAt: tweet.createdAt,
      url: tweet.url
    }));
  }
}

export const twitterService = new TwitterService();