module.exports = class Box {

  constructor() {
    let p = new Promise(resolve => {
      this._push = resolve
    })
    this.p = p
  }

  push(value) {
    this._value = value
    this._push(value)
    return this
  }

  get value() {
    return this._value
  }

  then(resolve, reject) {
    return this.p.then(resolve, reject)
  }

  catch(reject) {
    return this.p.catch(reject)
  }

}
