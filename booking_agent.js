const axios = require('axios')
const secrets = require('./secrets_default.json')
const event = require('./event.json')
let currentIter = 1

const defaultHeaders = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  Authorization: `ResyAPI api_key=\"${secrets.API_KEY}\"`,
  'cache-control': 'no-cache',
  'sec-ch-ua':
    '"Not.A/Brand";v="8", "Chromium";v="114", "Microsoft Edge";v="114"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
  'x-origin': 'https://resy.com',
  Priority: 'u=1, i',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36 Edge/17.17134',
  'X-Resy-Auth-Token': `${secrets.AUTH_TOKEN}`,
  'X-Resy-Universal-Auth': `${secrets.AUTH_TOKEN}`,
  Referer: 'https://resy.com/',
}

const getConfigToken = async () => {
  let token = null
  const config = {
    method: 'get',
    maxBodyLength: Infinity,
    url: `https://api.resy.com/4/find?lat=0&long=0&day=${event.day}&party_size=${event.party_size}&venue_id=${event.venue_id}`,
    headers: defaultHeaders,
  }

  try {
    const response = await axios.request(config)
    const slotsArray = await response.data.results.venues[0].slots
    console.log(
      `Let's look for ${event.day} ${event.timeHour}:${event.timeMinute} (or within ${event.window} minutes) at ${response.data.results.venues[0].venue.name}`
    )
    for (let i = 0; i < slotsArray.length; i++) {
      const element = slotsArray[i]
      if (
        element.date.start ===
          `${event.day} ${event.timeHour}:${event.timeMinute}:00` &&
        (event.diningLoc ? element.config.type === event.diningLoc : true)
      ) {
        token = element.config.token
        console.log(
          "Here's what I found: " +
            element.date.start +
            ' ' +
            element.config.type
        )
      }
    }
    if (!token) {
      //if you still can't find one, expand dates
      let backward = false
      for (let j = 0; j <= event.window && !token; j += 15) {
        let minutes = event.timeMinute + j + backward * -2 * j
        let hours = event.timeHour + Math.floor(minutes / 60)
        minutes = ((minutes % 60) + 60) % 60 ? ((minutes % 60) + 60) % 60 : '00'

        for (let i = 0; i < slotsArray.length && !token; i++) {
          const element = slotsArray[i]

          if (
            element.date.start === `${event.day} ${hours}:${minutes}:00` &&
            (event.diningLoc ? element.config.type === event.diningLoc : true)
          ) {
            token = element.config.token
            console.log(
              "Here's the closest I could find: " +
                element.date.start +
                ' ' +
                element.config.type
            )
          }
        }
        j -= backward * 15
        backward = !backward
      }
    }
  } catch (error) {
    console.log('There was a problem with the configuration function.')
    console.log(JSON.stringify(error))
  }

  return token
}

const getBookingToken = async () => {
  let token = null
  const config_id = await getConfigToken()

  if (!config_id) return null

  const config = {
    method: 'get',
    maxBodyLength: Infinity,
    url: `https://api.resy.com/3/details?party_size=${event.party_size}&day=${event.day}&config_id=${config_id}`,
    headers: defaultHeaders,
  }

  try {
    const response = await axios.request(config)
    token = await response.data.book_token.value
  } catch (error) {
    console.log('There was a problem getting the booking token.')
    console.log(error)
  }

  return token
}

const getFinalToken = async () => {
  let resy_token = null
  const book_token = await getBookingToken()
  const data = new URLSearchParams()

  if (!book_token) return null
  console.log(book_token, 'book_token')

  data.append('book_token', `${book_token}`)
  data.append('source_id', 'resy.com-venue-details')

  let config = {
    method: 'POST',
    maxBodyLength: Infinity,
    url: 'https://api.resy.com/3/book',
    headers: {
      ...defaultHeaders,
      'x-origin': 'https://widgets.resy.com',
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: 'https://widgets.resy.com/',
    },
    data: data,
  }

  try {
    const response = await axios.request(config)
    resy_token = await response.data.resy_token
  } catch (error) {
    console.log('There was a problem booking the reservation.')
    console.log(JSON.stringify(error))
  }

  return resy_token
}

const tryAndAgain = async () => {
  let call = await getFinalToken()
  currentIter += 1

  if (call) {
    console.log(
      'I was able to book your dinner! Check your account for confirmation.'
    )
  } else if (currentIter <= event.allowedIter) {
    console.log('Searching again...')
    call = await tryAndAgain()
  } else {
    console.log('I really did try!')
  }

  return call
}

const runMe = async () => {
  const finalToken = await tryAndAgain()
  console.log(finalToken)
}

runMe()
