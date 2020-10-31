import React from 'react'
import { Badge, Button } from 'react-bootstrap'
import { useDispatch, useSelector } from 'react-redux'
import { connect } from './walletSaga';

export default function Wallet() {
    const dispatch = useDispatch();
    const {
        account, network, isApproved
    } = useSelector(state => state.wallet);

    const checkMark = isApproved ?
        <span aria-label="approved" className="ml-1">🗸</span>
        : null

    const content = account ?
        <h6>
            <Badge className="m-2" variant="secondary">
                {account.substring(0, 4)}...{account.substring(account.length - 4)}{checkMark}<br/>
                {network.name}
            </Badge>
        </h6>
        : <Button onClick={() => dispatch(connect())}>
            Connect
        </Button>

    return (
        <div>{content}</div>
    )
}
