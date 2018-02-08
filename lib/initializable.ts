interface Initializable {
  init(): Promise<this>
}

export = Initializable
