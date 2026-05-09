import container from 'luca/node'

const opener = container.feature('opener')

await opener.open('https://www.google.com')