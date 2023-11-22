import express from 'express'
import ytdl from 'ytdl-core'
import fs from 'fs'
import { spawn } from 'child_process'
import crypto from 'crypto'
import cors from 'cors'
import ytsr from 'ytsr'
import findRemoveSync from 'find-remove'
import path from 'path'

const app = express()
app.use(cors())
const port = 3046

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

setInterval(() => {
  findRemoveSync(path.join(__dirname, '/uploads'), { age: { seconds: 3600 }, files: '*.*' })
}, 1800)

app.post('/convertSong', (req, res) => {
  const URL = req.body.link
  const tempo = req.body.tempo
  const pitch = req.body.pitch
  const SongName: string[] = []

  let randomName: string = ''
  randomName = crypto.randomBytes(20).toString('hex')
  try {
    downloadVideo(URL, randomName, SongName)
      .then(() => {
        setTimeout(() => {
          const pathTemp = path.join(__dirname, 'tmp', randomName)
          const pathOutput = path.join(__dirname, 'uploads', randomName)

          const command = `ffmpeg -i ${pathTemp}.wav -af asetrate=44100*${pitch},aresample=44100,atempo=${tempo} ${pathOutput}.wav`
          const commandParts = command.split(' ')
          const spawnedProcess = spawn(commandParts[0], commandParts.slice(1))

          // exec(command, (error, stdout, stderr) => {
          //   if (error !== null) {
          //     console.error(`Error: ${error.message}`)
          //     return res.status(500).json({
          //       error: `Error executing command: ${error.message}`
          //     })
          //   }
          //   fs.unlink(`./tmp/${randomName}.wav`, () => {})
          //   return res.status(200).json({
          //     nombre: SongName[0],
          //     fileName: randomName
          //   })
          // })

          spawnedProcess.on('error', (error: any) => {
            console.error(`Error: ${error.message}`)
            return res.status(500).json({
              error: `Error executing command: ${error.message}`
            })
          })
          spawnedProcess.on('exit', (code: any) => {
            if (code !== 0) {
              console.error(`Command failed with code ${code}`)
              return res.status(500).json({
                error: `Command failed with code ${code}`
              })
            }
            fs.unlink(`./tmp/${randomName}.wav`, () => {})

            return res.status(200).json({
              nombre: SongName[0],
              fileName: randomName
            })
          })
        }, 1000)
      })

      .catch((err) => {
        return res.status(500).json({
          error: err
        })
      })
  } catch (err: any) {
    console.error('Error during video download:', err)
    return res.status(500).json({
      error: `Error during video download: ${err.message}`
    })
  }
})

app.get('/download/:id', (req, res) => {
  const file = `./uploads/${req.params.id}.wav`
  res.download(file)
})

app.post('/youtubeSearch', (req, res) => {
  const search = req.body.search
  youtubeSearch(search)
    .then(e => {
      return res.status(200).json({
        data: e.items
      })
    })
    .catch(error => {
      console.log(error)
      return res.status(500).json({
        prueba: error
      })
    })
})

const youtubeSearch = async (name: string): Promise<any> => {
  const searchResults = await ytsr(name)
  console.log(searchResults)
  return searchResults
}

app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`)
})

const downloadVideo = async (link: string, randomName: string, SongName: string[]): Promise<void> => {
  try {
    console.log(path.join(__dirname, 'tmp', randomName + '.wav'))
    const regex = /^https?:\/\/(?:www\.)?youtube\.com\/.*$/
    if (!regex.test(link)) {
      const regex2 = /^(http(s)?:\/\/)?((w){3}.)?youtu(be|.be)?(\.com)?\/.+/
      if (regex2.test(link)) {
        ytdl('https://' + link, { filter: 'audioonly' })
          .pipe(fs.createWriteStream(path.join(__dirname, 'tmp', randomName + '.wav')))

        const name = await ytdl.getInfo('https://' + link)
        SongName.push(name.videoDetails.title)
      } else {
        throw new Error('Error during video download:')
      }
    } else {
      ytdl(link, { filter: 'audioonly' })
        .pipe(fs.createWriteStream(path.join(__dirname, 'tmp', randomName + '.wav')))

      const name = await ytdl.getInfo(link)
      SongName.push(name.videoDetails.title)
    }
  } catch (err: any) {
    throw new Error(`Error during video download: ${err.message}`)
  }
}
