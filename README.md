# Domain Squatting Crawler with Web Interface (NAME TBD)

# Introduction
This repo is for the development of a crawler that monitors for domain squatting. Domain squatting is defined as the act of using  an internet domain name with bad intentions to profit from a similar domain owned by someone else.

## The Uhh Team
+ --------------- +\
| Team Number: 2  |\
+ --------------- +\
Brian Jang\
Maggie Zhou\
Qihong Jiang\
Danny Guo

# The Plan
### Front-end
 * User interface for submitting a domain to monitor and determining # of worker nodes.
 * Functionality for users to submit IP addresses of worker nodes
    * User must download the available client to run on the servers (potentially use a docker image?)
 * Display a list of HTMLs with screenshots of the suspected domains
 * Bootstrap to make it pretty
 
### Back-end
 * Current planned language to use will be JSS with the ExpressJS framework.
 * Will use a headless chrome to crawl and take a screenshot of each suspected domain squatter. Specifically the crawler used is a tool built upon Puppeteer (https://github.com/yujiosaka/headless-chrome-crawler).
  * Load balancing with Apache
  * MongoDB database for caching previously stored captures
  * If no servers provided by user, we use multi-threading
  
#### Typo Generation Models
As described in Section 3.1 of https://www.usenix.org/legacy/event/sruti06/tech/full_papers/wang/wang.pdf
  * (1) Missing-dot typos
      * Suspect deletes a '.' from target domain
  * (2) Character-omission typos
      * Suspect deletes a letter from target domain
  * (3) Character-permutation typos
      * Suspect swaps a pair of characters
  * (4) Character-replacement typos
      * Suspect replaces a character
  * (5) Character-insertion typos
      * Suspect inserts a character that is adjacent on the keyboard to a letter in the domain
     
#### Set Up Instructions
Due to file limits by Github, node_modules files are not provided; these dependencies have to be installed by the user.
  * (1) Express Framework
      * npm install express
  * (2) Mongo-DB
      * npm install mongo
  * (3) Headless-Chrome-Crawler
      * npm install headless-chrome-crawler
      * export (required ENV var) = false for first time installation if Headless Chromium is never installed
