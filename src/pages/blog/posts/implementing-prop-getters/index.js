import {basename} from 'path'
import Markdown from '../../../../components/markdown'
import Disqus from '../../../../components/disqus'

export const title = 'How to give rendering control to users with prop getters'

export default Post

function Post() {
  return (
    <div style={{maxWidth: 800, margin: 'auto', fontSize: '22px'}}>
      <h1 style={{textAlign: 'center', fontSize: '1.4em'}}>{title}</h1>
      <div>
        <Markdown>
          {`
            Since I [released downshift 🏎](https://medium.com/@kentcdodds/introducing-downshift-for-react-b1de3fca0817)
            a few weeks ago. Of all things, I think the most common question I've gotten has been about the
            "prop getters." As far as I know, [downshift](https://github.com/paypal/downshift) is the first library to
            implement this pattern, so I thought I'd explain why it's useful and how to implement it. If you're
            unfamiliar with downshift, please read
            [the intro post](https://medium.com/@kentcdodds/introducing-downshift-for-react-b1de3fca0817) before you
            continue. Don't worry, I'll wait...

            ![dog waiting patiently](waiting.gif)

            So, to recap from what you read, prop getters are one piece to the puzzle to let you hand rendering over to
            the users of your components (a great idea). I got the idea from
            [Jared Forsyth](https://twitter.com/jaredforsyth) one day at an airport. You can only really use it with the
            [render prop pattern](https://medium.com/merrickchristensen/function-as-child-components-5f3920a9ace9).
            It's basically a function which will return props when called and people must apply those props to the
            right element to hook all the elements that are rendered together to make the overarching component.
            Hopefully that's clear 😀

            To talk about this, we'll actually use a different component I wrote recently that uses this pattern called
            [~react-toggled~](https://github.com/kentcdodds/react-toggled).

            [![react-toggled logo](react-toggled.png)](https://github.com/kentcdodds/react-toggled)

            It's pretty small, so I'm just going to paste all of it here for you:

            ~~~
            import {Component} from 'react'
            import PropTypes from 'prop-types'

            const callAll = (...fns) => (...args) => fns.forEach(fn => fn && fn(...args))

            class Toggle extends Component {
              static propTypes = {
                defaultOn: PropTypes.bool,
                on: PropTypes.bool,
                onToggle: PropTypes.func,
                children: PropTypes.oneOfType([PropTypes.func, PropTypes.array]).isRequired,
              }
              static defaultProps = {
                defaultOn: false,
                onToggle: () => {},
              }
              state = {
                on: this.getOn({on: this.props.defaultOn}),
              }

              getOn(state = this.state) {
                return this.isOnControlled() ? this.props.on : state.on
              }

              isOnControlled() {
                return this.props.on !== undefined
              }

              getTogglerProps = (props = {}) => ({
                'aria-controls': 'target',
                'aria-expanded': Boolean(this.getOn()),
                ...props,
                onClick: callAll(props.onClick, this.toggle),
              })

              getTogglerStateAndHelpers() {
                return {
                  on: this.getOn(),
                  getTogglerProps: this.getTogglerProps,
                  setOn: this.setOn,
                  setOff: this.setOff,
                  toggle: this.toggle,
                }
              }

              setOnState = (state = !this.getOn()) => {
                if (this.isOnControlled()) {
                  this.props.onToggle(state, this.getTogglerStateAndHelpers())
                } else {
                  this.setState({on: state}, () => {
                    this.props.onToggle(this.getOn(), this.getTogglerStateAndHelpers())
                  })
                }
              }

              setOn = this.setOnState.bind(this, true)
              setOff = this.setOnState.bind(this, false)
              toggle = this.setOnState.bind(this, undefined)

              render() {
                const renderProp = unwrapArray(this.props.children)
                return renderProp(this.getTogglerStateAndHelpers())
              }
            }

            /**
             * Takes an argument and if it's an array, returns the first item in the array
             * otherwise returns the argument
             * @param {*} arg the maybe-array
             * @return {*} the arg or it's first item
             */
            function unwrapArray(arg) {
              return Array.isArray(arg) ? arg[0] : arg
            }

            export default Toggle
            ~~~

            <p style="font-size:0.9em;opacity:0.8;margin-left:20px">
              You'll notice that ~this.props.children~ is unwrapped, this is for preact compatibility.
            </p>

            And here's how you could use ~react-toggled~:

            ~~~
            <Toggle>
              {({on, getTogglerProps}) => (
                <div>
                  <button {...getTogglerProps({ onClick() { alert('you clicked!') } })}>
                    Toggle me
                  </button>
                  <div>{on ? 'Toggled On' : 'Toggled Off'}</div>
                </div>
              )}
            </Toggle>
            ~~~

            There are a few neat things about this component I may talk about in a future post, but for now, let's focus
            on the ~getTogglerProps~ function (that's the prop getter).

            The cool thing about this pattern is that it allows users to render whatever they want. So your components
            take care of the hard and generic part (the logic of the component) and the user can take care of the easy
            and less-generic part: what to show and how it's styled given the state of the component.

            So if you want the ~<div>~ to appear above the ~<button>~ or to not appear at all, then the user can simply
            do that without having to look up any docs for props or anything. This is pretty powerful!

            With that said,
            [the biggest question I get from folks about "prop getters"](https://twitter.com/sprjrx/status/908367026619506688)
            is:

            > Why are you using a function to get props? Why not just pass a regular object to my render callback and
            > let me spread that instead of having to call a function?

            What people are saying is they'd prefer to do: ~<button {...togglerProps} {...myOwnProps} />~ rather than
            ~<button {...getTogglerProps(myOwnProps)} />~. I can understand why folks might prefer that. It feels like
            you have more control that way. However, we're actually doing something useful with this function and the
            props that you provide...

            For this component, we care about the ~onClick~ prop you apply to your ~<button>~. We need to call
            ~this.toggle~. But what if you (as a user of the component) also wanted to have a handler for ~onClick~?
            You might try to write it like this: ~<button onClick={this.handleClick} {...togglerProps} />~. But you'd
            find that ~togglerProps~ overrides your custom ~onClick~ handler, so you could switch it to:
            ~<button {...togglerProps} onClick={this.handleClick} />~ and now you have the opposite problem! Your custom
            ~onClick~ is overriding the ~onClick~ from ~togglerProps~, so ~react-toggled~ isn't working at all.

            With that context, let's see how we avoid this problem by using a function. Check out the implementation of
            ~getTogglerProps~:

            ~~~
            getTogglerProps = (props = {}) => ({
              'aria-controls': 'target',
              'aria-expanded': Boolean(this.getOn()),
              ...props,
              onClick: callAll(props.onClick, this.toggle),
            })
            ~~~

            You'll notice that the ~onClick~ prop is assigned to ~callAll(props.onClick, this.toggle)~. The ~callAll~
            function is pretty simple:

            ~~~
            const callAll = (...fns) => (...args) => fns.forEach(fn => fn && fn(...args))
            ~~~

            It does what it says. Calls all the functions it's given, if they exist. In our case, both of our ~onClick~
            handlers will be called as we need.

            ---

            To summarize, prop getters are one of the patterns that enable you to hand rendering responsibility to the
            user of your components (a really awesome idea). You can only really implement it with the render prop
            pattern (in our case we use the ~children~ prop, but you could use a ~render~ prop if you prefer).

            Here are a few projects that implement the prop getters pattern:

            - [~downshift~ 🏎](https://github.com/paypal/downshift) - Primitive for building simple, flexible, WAI-ARIA compliant enhanced input React components
            - [~react-toggled~](https://github.com/kentcdodds/react-toggled) - Component to build simple, flexible, and accessible toggle components
            - [~dub-step~ 🕺](https://github.com/infiniteluke/dub-step) - Step through an index with style
            - [~react-stepper-primitive~](https://github.com/ajoslin/react-stepper-primitive) - React primitives for a "stepper" component.

            I hope to see more folks doing stuff like this in the future! Good luck to you all! 👍

            **Things to not miss:**

            - [~import-all.macro~](https://github.com/kentcdodds/import-all.macro) - A work in progress babel-macro that allows you to import all files that match a glob
            - [~react-powerplug~](https://github.com/renatorib/react-powerplug) - Pretty neat/interesting idea with the render prop pattern.
            - [~graphql-tag.macro~](https://github.com/leoasis/graphql-tag.macro) - Impressive babel-macro that precompiles graphql queries.
            - [~size-limit~](https://github.com/ai/size-limit) - Prevent JS libraries bloat. If you accidentally add a massive dependency, Size Limit will throw an error.
            - [left-pad not found sticker](https://www.stickermule.com/marketplace/11354-left-pad) - See below. This was created by my friend [Tyler McGinnis](https://twitter.com/tylermcginnis) (of Tyler McGinnis fame) and I think it's pretty funny.

            [![left-pad sticker](left-pad.png)](https://www.stickermule.com/marketplace/11354-left-pad)

            _**P.S. If you like this, make sure to [subscribe](http://tinyletter.com/kentcdodds),
            [follow me on twitter](https://twitter.com/kentcdodds),
            [buy me lunch](http://kcd.im/donate),
            and [share this with your friends](https://tinyletter.com/kentcdodds) 😀**_
          `.replace(/~/g, '`')}
        </Markdown>
        <small>
          See more blogposts from me <a href="/post">here</a>.
        </small>
      </div>
      <Disqus
        style={{marginTop: 50}}
        id={title}
        url={`https://kentcdodds.com/post/${basename(__dirname)}`}
      />
    </div>
  )
}
