import { Container } from './container'
import Client from './client'
import SDWebUIClient from './clients/stable-diffusion-webui'

export default new Container({})
  .use(Client)
  .use(SDWebUIClient)