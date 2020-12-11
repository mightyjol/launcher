import low from 'lowdb'
import LocalStorage from 'lowdb/adapters/LocalStorage'
import { defaults } from './demo/db_default'

const adapter = process.browser ? new LocalStorage('db') : false
export let db = process.browser ? low(adapter).defaults(defaults) : false
 