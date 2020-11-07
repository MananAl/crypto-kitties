import { createAction } from "@reduxjs/toolkit";
import { all, fork, put, race, select, take } from "redux-saga/effects";
import { breedKitties, fetchKitty, kittenBorn } from "../cat/catSlice";
import { selectParentIds, breedError, breedProgress, BreedProgress, kittenBredEvent, setParent } from './breedSlice';
import { dispatchKittenOnBirthEventMatch } from '../cat/catSaga';
import { buySireRites } from "../market/offerSlice";

export const approveParent = createAction(
    'breed/approveParent',
    ({ parentId, parentType }) => {
        return { payload: { parentId, parentType } }
    }
);
export const parentApproved = createAction('breed/parentApproved');

export const breed = createAction(
    'breed/breed',
    ({ mumId, dadId }) => {
        return { payload: { mumId, dadId } }
    }
);

export const sire = createAction(
    'breed/sire',
    ({ offer, matronId }) => {
        return { payload: { offer, matronId } }
    }
)



export function* breedSaga() {
    yield all([
        validateParent(),
        onBreed(),
        onSire(),
    ]);
}

function* validateParent() {
    while (true) {
        try {
            const action = yield take(approveParent);
            const { parentId, parentType } = action.payload;

            let currentParents = yield select(selectParentIds);

            // approved if no current parent of that type
            // or different than the current
            if (isDifferent(parentId, currentParents)) {
                yield put(setParent({ parentId, parentType }));

            } else {
                yield put(breedProgress(BreedProgress.ERROR_SAME_PARENT));
            }

            // ready to breed if both parents now selected
            currentParents = yield select(selectParentIds);
            if (setReady(currentParents)) {
                yield put(breedProgress(BreedProgress.READY));
            }

        } catch (err) {
            console.error(err);
            yield put(breedError(err.message));
        }
    }
}

function isDifferent(parentId, currentParents) {
    // must be different than both current parents
    return parentId !== currentParents.mumId &&
        parentId !== currentParents.dadId;
}

function setReady(currentParents) {
    // both parents are defined
    // don't set if progress was already ready
    return currentParents.progress !== BreedProgress.READY &&
        Boolean(currentParents.mumId) &&
        Boolean(currentParents.dadId);
}

function* onBreed() {
    while (true) {
        try {
            const breedAction = yield take(breed);
            const { mumId, dadId } = breedAction.payload;

            // dispatch breed action and
            // listen for kitten birth event
            const result = yield race({
                breed: all({
                    listen: fork(
                        dispatchKittenOnBirthEventMatch,
                        kitten => kitten.mumId === mumId &&
                            kitten.dadId === dadId
                    ),
                    dispatch: put(breedKitties(breedAction.payload)),
                    kittenAction: take(kittenBorn),
                }),
                error: take(breedKitties.rejected),
            });

            if(result.error) {
                yield put(breedError(result.error.error.message));
                continue;
            }

            // update parent cooldowns after breeding
            yield all([
                put(kittenBredEvent(result.breed.kittenAction.payload.kittyId)),
                put(fetchKitty(mumId)),
                put(fetchKitty(dadId)),
            ]);
        } catch (err) {
            yield put(breedError(err.message));
        }
    }
}

function* onSire() {
    const sireAction = yield take(sire);
    const { offer, matronId } = sireAction.payload;
    const sireId = offer.tokenId;

    yield fork(
        dispatchKittenOnBirthEventMatch,
        kitten => kitten.mumId === matronId &&
            kitten.dadId === sireId
    );

    yield put(buySireRites({ offer, matronId }));

    const { kittenAction } = yield all({
        fulfilled: take(buySireRites.fulfilled),
        kittenAction: take(kittenBorn)
    });

    // update parent cooldowns after breeding
    yield all([
        put(kittenBredEvent(kittenAction.payload.kittyId)),
        put(fetchKitty(matronId)),
        put(fetchKitty(sireId)),
    ]);
}
