const axios = require('axios');
const FormData = require('form-data');

let api_key = "VbWk7s3L4KiK5fzlO7JD3Q5EYolJI7n5";
let auth_token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJleHAiOjE2ODM3NTA2NjEsInVpZCI6NDAzNTkyODQsImd0IjoiY29uc3VtZXIiLCJncyI6W10sImxhbmciOiJlbi11cyIsImV4dHJhIjp7Imd1ZXN0X2lkIjoxMzI5Mjc5NTh9fQ.ALoDgeVfZxiM1i80JUnSyITLgyAvLbfw3zc5Oat5vBYjQoc6yAA3d90dxmqsDcR-2CEXWOVmWyqh3kd7igOdiUTTAGFpt2pUosiR7g163pc0ALPMtO6BZWMwQ08K5RIVHZ-2RDzNxhMl3KMmiM_w7GU3k2e6rRjotyYKEaqlWnwkEcgl";
let day = "2023-03-31";
let timeHour = 20;
let timeMinute = 0;
let window = 60; //time to look before and after if reservation not available (in minutes)
let diningLoc = null; //set to null if doesn't matter
let party_size = "2";
let venue_id = "6194";
let allowedIter = 100; //should be like 500 for midnights
let currentIter = 0;

let resy_token = confirm();

async function confirm() {

    let call = await getConfigToken();
    
    currentIter += 1;
    
    if (call) {
        console.log("I was able to book your dinner! Check your account for confirmation.");
    } else if (currentIter <= allowedIter) {
        console.log("Searching again...");
        call = await confirm();
    } else {
        console.log("I really did try!");
    }

    return call;
}

async function getConfigToken() {

    let token = null;

    let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://api.resy.com/4/find?lat=0&long=0&day=${day}&party_size=${party_size}&venue_id=${venue_id}`,
        headers: {
            'Authorization': `ResyAPI api_key="${api_key}"`
        }
    };

    await axios.request(config)
        .then((response) => {
            const slotsArray = response.data.results.venues[0].slots;
            console.log(`Let's look for ${day} ${timeHour}:${timeMinute} (or within ${window} minutes) at ${response.data.results.venues[0].venue.name}`);
            for (let i = 0; i < slotsArray.length; i++) {
                const element = slotsArray[i];
                if (element.date.start == `${day} ${timeHour}:${timeMinute}:00` && (diningLoc ? element.config.type == diningLoc : true)) {
                    token = element.config.token;
                    console.log("Here's what I found: " + element.date.start + " " + element.config.type);
                }
            }
            if (!token) { //if you still can't find one, expand dates
                let backward = false;
                for (let j = 0; j <= window && !token; j += 15) {

                    let minutes = timeMinute + j + (backward*-2*j);
                    let hours = timeHour + Math.floor(minutes / 60);
                    minutes = (minutes % 60 + 60) % 60 ? (minutes % 60 + 60) % 60 : "00";

                    for (let i = 0; i < slotsArray.length && !token; i++) {
                        const element = slotsArray[i];

                        if (element.date.start == `${day} ${hours}:${minutes}:00` && (diningLoc ? element.config.type == diningLoc : true)) {
                            token = element.config.token;
                            console.log("Here's the closest I could find: " + element.date.start + " " + element.config.type);
                        }
                    }
                    j -= backward * 15;
                    backward = !backward;
                }
            }
        })
        .catch((error) => {
            console.log("There was a problem with the configuration function. Rerun for details."); //error);
        });

    return token;
}

async function getResDetails() {

    let config_id = await getConfigToken();
    if (!config_id) {
        return null;
    }

    let token = null;

    let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://api.resy.com/3/details?party_size=${party_size}&day=${day}&config_id=${config_id}`,
        headers: {
            'Authorization': `ResyAPI api_key="${api_key}"`
        }
    };

    await axios.request(config)
        .then((repsonse) => {
            token = repsonse.data.book_token.value;
        })
        .catch((error) => {
            console.log("There was a problem with the details function. Rerun for details."); //error);
        });

    return token;
}

async function bookRes() {

    let book_token = await getResDetails();
    console.log(book_token); //delete
    if (!book_token) {
        return null;
    }
    let resy_token = null;

    let data = new FormData();
    data.append('book_token', book_token);

    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://api.resy.com/3/book',
        headers: {
            'x-resy-auth-token': auth_token,
            'Authorization': `ResyAPI api_key="${api_key}"`,
            ...data.getHeaders()
        },
        data: data
    };

    await axios.request(config)
        .then((response) => {
            resy_token = response.data.resy_token;
        })
        .catch((error) => {
            console.log("There was a problem with the booking function. Rerun for details."); //error);
        });

    return resy_token;
}