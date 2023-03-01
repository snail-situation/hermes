import { useEffect } from 'preact/hooks'
import * as wn from "webnative"
import { FunctionComponent } from 'preact'
import { Signal } from '@preact/signals'
import { useSignal } from '@preact/signals'
import ky from 'ky'
import './route-friends.css'
import { Request } from '../friend.js'
import ButtonTwo from '../components/button-two.jsx'
import { LOG_DIR_PATH, BLOB_DIR_PATH, APP_INFO,
    FRIENDS_PATH } from '../CONSTANTS.js'
import { UserData } from '../username.js'

interface Props {
    session: Signal<wn.Session | null>
    friendsList: Signal<Request[]>
    friendProfiles: Signal<{ [key:string]: UserData }>
}

export const Friends:FunctionComponent<Props> = function (props) {
    const { session, friendsList, friendProfiles } = props
    // const friendsList = useSignal<Friend[] | []>([])
    const incomingRequests = useSignal<Request[]>([])
    const outgoingRequests = useSignal<Request[]>([])
    const isAccepting = useSignal<boolean>(false)

    // get incoming and outgoing friend requests
    useEffect(() => {
        if (!session.value?.username) return
        const qs = new URLSearchParams({
            fromto: session.value.username
        }).toString()

        ky.get(`/api/friend-request?${qs}`).json()
            .then((res) => {
                const outgoing = (res as Array<Request>).filter(msg => {
                    return msg.value.from === session.value?.username
                })
                if (outgoing.length) outgoingRequests.value = outgoing

                const incoming = (res as Array<Request>).filter(msg => {
                    return msg.value.to === session.value?.username
                })
                if (incoming.length) incomingRequests.value = incoming
            })
            .catch(err => {
                console.log('errrrr', err)
            })
    }, [session.value])

    async function accept (req:Request, ev:Event) {
        ev.preventDefault()
        // @TODO
        // set up shared private files here
        // see https://guide.fission.codes/developers/webnative/sharing-private-data
        // see https://github.com/users/nichoth/projects/4/views/1?pane=issue&itemId=20845590

        isAccepting.value = true

        const friendsListPath = wn.path.appData(
            APP_INFO,
            wn.path.file(FRIENDS_PATH)
        )

        let friendListData:Request[] = []
        try {
            const data = new TextDecoder().decode(
                await session.value?.fs?.read(friendsListPath)
            )
            friendListData = JSON.parse(data)
        } catch (err) {
            console.log('reading friend list error', err)
            if ((err as Error).toString().includes('Path does not exist')) {
                // do nothing
            }
        }

        const el = friendListData.find(existingFriend => {
            return (existingFriend.value.from === req.value.from)
        })
        if (el) {
            isAccepting.value = false
            // this shouldn't happen
            return console.log('already friends...')
        }

        friendListData.push(req)
        const filepath = wn.path.appData(
            APP_INFO,
            wn.path.file(FRIENDS_PATH)
        )
        const fs = session.value?.fs
        if (!fs) return console.log('oh no')

        await fs.write(
            filepath,
            new TextEncoder().encode(JSON.stringify(friendListData))
        )

        const shareDetails = await fs.sharePrivate(
            [
                wn.path.appData(APP_INFO, wn.path.directory(LOG_DIR_PATH)),
                wn.path.appData(APP_INFO, wn.path.directory(BLOB_DIR_PATH))
            ],
            { shareWith: req.value.from } // alternative: list of usernames, or sharing/exchange DID(s)
        )

        console.log('**share details**', shareDetails)

        isAccepting.value = false
        friendsList.value = friendListData
    }

    // need to map the friend list to a list of profiles

    return <div className="route route-friends">
        <h1>Friendship information</h1>

        <p>
            <a href="/friends/request">Request a new friend</a>
        </p>

        <h2>Incoming friend requests</h2>
        {!(incomingRequests.value).length ?
            (<p><em>none</em></p>) :
            (<ul>
                {(incomingRequests.value.map(req => {
                    return <li className="friend-request">
                        <span>{req.value.from}</span>
                        <ButtonTwo isSpinning={isAccepting.value}
                            onClick={accept.bind(null, req)}
                        >
                            Accept friendship
                        </ButtonTwo>
                    </li>
                }))}
            </ul>)
        }

        <h2>Outgoing friend requests</h2>
        {!outgoingRequests.value.length ?
            (<p><em>none</em></p>) :
            (<ul>
                {outgoingRequests.value.map(req => {
                    return <li className="friend-request">{req.value.to}</li>
                })}
            </ul>)
        }

        <h2>Friends</h2>
        {!friendsList.value.length ?
            (<p><em>none</em></p>) :
            (<ul>
                {friendsList.value.map(friend => {
                    return <li className="friend">
                        {(friendProfiles.value[friend.value.from])?.humanName}
                    </li>
                })}
            </ul>)
        }
    </div>
}
