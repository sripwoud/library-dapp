const LibraryData = artifacts.require('LibraryData')
const LibraryApp = artifacts.require('LibraryApp')
const truffleAssert = require('truffle-assertions')

contract('Library tests', async (accounts) => {
  let libraryData, libraryApp
  const book = {
    title: 'Test',
    author: 'Gry0u',
    publishedDate: Math.floor(Date.now() / 1000),
    originLibrarian: 'Library'
  }

  before('setup contract', async () => {
    libraryData = await LibraryData.deployed()
    libraryApp = await LibraryApp.deployed()

    await libraryData.authorizeCaller(libraryApp.address)
  })

  it('Owner addresses correctly set', async () => {
    const ownerLib = await libraryData.libraryOwner()
    const ownerApp = await libraryApp.appOwner()
    assert.equal(accounts[0], ownerLib, 'Wrong library owner address')
    assert.equal(accounts[0], ownerApp, 'Wrong App owner address')
  })
  it('Has correct initial operational values', async function () {
    // Get operating status
    const statusData = await libraryData.operational()
    const statusApp = await libraryApp.operational()
    assert(statusData, 'Data contract has an incorrect initial operating status value')
    assert(statusApp, 'Data contract has an incorrect initial operating status value')
  })

  it('(Data contract) Blocks access to setOperatingStatus() for non-Contract Owner account (tested only for data contract)', async function () {
    // Ensure that access is denied for non-Contract Owner account
    let rejected = false
    try {
      await libraryData.setOperatingStatus(false, { from: accounts[1] })
    } catch (error) {
      rejected = true
    }
    assert(rejected, 'Access to operational control function was not blocked')
  })

  it('Contract owner can change operational status (tested for data contract only)', async function () {
    await libraryData.setOperatingStatus(false)
    assert.equal(await libraryData.operational(), false, 'Failed to change operational status')
  })

  it('Owner can add librarians', async () => {
    // set contract back to operational
    await libraryData.setOperatingStatus(true)
    const tx = await libraryApp.setMembership(accounts[1], true)
    assert(
      await libraryData.librarians.call(accounts[1]),
      'Librarian was not added'
    )
    truffleAssert.eventEmitted(
      tx,
      'Membership',
      ev => {
        return ev.added === true & ev.librarian === accounts[1]
      },
      'Membership event not correctly emitted'
    )
  })

  it('Owner can remove librarians', async () => {
    const tx = await libraryApp.setMembership(accounts[1], false)
    assert.equal(
      await libraryData.librarians.call(accounts[1]),
      false,
      'Librarian was not removed'
    )
    truffleAssert.eventEmitted(
      tx,
      'Membership',
      ev => {
        return ev.added === false & ev.librarian === accounts[1]
      },
      'Membership event not correctly emitted'
    )
  })

  it('Librarians may add books to the library', async () => {
    // add back librarian
    await libraryApp.setMembership(accounts[1], true)
    const tx = await libraryApp.insertBook(
      book.title,
      book.author,
      book.publishedDate,
      { from: accounts[1] }
    )
    const bookKey = await libraryData.getBookKey(book.title, book.author, book.publishedDate)
    assert(await libraryData.isBook(bookKey), 'Book was not added correctly')
    truffleAssert.eventEmitted(
      tx,
      'BookAdded',
      ev => {
        return ev.title == book.title &
        ev.author == book.author &
        ev.publishedDate == book.publishedDate &
        ev.originLibrarian == accounts[1]
      },
      'BookAdded event not emitted correctly'
    )
  })

  it('Librarians may remove books from the library', async () => {
    const tx = await libraryApp.deleteBook(
      book.title,
      book.author,
      book.publishedDate,
      { from: accounts[1] }
    )
    const bookKey = await libraryData.getBookKey(book.title, book.author, book.publishedDate)
    assert.equal(
      await libraryData.isBook(bookKey),
      false,
      'Book was not deleted correctly'
    )
    truffleAssert.eventEmitted(
      tx,
      'BookDeleted',
      ev => {
        return ev.title == book.title &
        ev.author == book.author &
        ev.publishedDate == book.publishedDate
      },
      'BookDeleted event not emitted correctly'
    )
  })

  it('Only librarians may check books out to an address', async () => {
    // re insert book
    await libraryApp.insertBook(
      book.title,
      book.author,
      book.publishedDate,
      { from: accounts[1] }
    )
    // address not regsitered as librarian fails to check out book
    let fail = false
    try {
      await libraryApp.checkOutBook(
        accounts[3],
        book.title,
        book.author,
        book.publishedDate,
        { from: accounts[2] }
      )
    } catch (error) {
      fail = true
    }
    assert(fail, 'Book check out should have failed')

    // check out book from a librarian address
    const tx = await libraryApp.checkOutBook(
      accounts[3],
      book.title,
      book.author,
      book.publishedDate,
      { from: accounts[1] }
    )
    const bookKey = await libraryData.getBookKey(book.title, book.author, book.publishedDate)
    const _book = await libraryData.books.call(bookKey)
    assert(_book.checkedOut, 'Book should be checked out')
    assert.equal(_book.currentOwner, accounts[3], 'Wrong book owner')
    truffleAssert.eventEmitted(
      tx,
      'BookCheckedOut',
      ev => {
        return ev.borrower == accounts[3]
      },
      'Event not emitted correctly'
    )
  })

/*
  it('A book owner may trade the book to anyone else', async => {

  })

  it('Anyone may check in a book', async () => {

  })



  it("Track the history of a book's ownership", async () => {

  })

  it('Record damage or repair (notes) for a book', async () => {

  })
  */
})
