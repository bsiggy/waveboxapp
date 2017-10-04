import React from 'react'
import PropTypes from 'prop-types'
import { IconButton } from 'material-ui'
import ReactPortalTooltip from 'react-portal-tooltip'
import uuid from 'uuid'
import { settingsActions, settingsStore, Tour } from 'stores/settings'
import * as Colors from 'material-ui/styles/colors'

const styles = {
  // Icon
  container: {
    textAlign: 'center'
  },
  icon: {
    WebkitAppRegion: 'no-drag'
  },

  // Main popover
  popover: {
    style: {
      background: 'rgba(34, 34, 34, 0.9)',
      paddingTop: 8,
      paddingBottom: 8,
      paddingLeft: 16,
      paddingRight: 16,
      fontSize: '13px',
      color: 'white'
    },
    arrowStyle: {
      color: 'rgba(34, 34, 34, 0.9)',
      borderColor: false
    }
  },

  // Tour popover
  tourPopover: {
    style: {
      background: Colors.lightBlue400,
      paddingTop: 8,
      paddingBottom: 8,
      paddingLeft: 16,
      paddingRight: 16,
      fontSize: '13px',
      color: 'white',
      cursor: 'pointer'
    },
    arrowStyle: {
      color: Colors.lightBlue400,
      borderColor: false
    }
  },

  // Tour content
  popoverContentContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center'
  },
  popoverButtonContainer: {
    paddingLeft: 32
  },
  basePopoverButton: {
    marginTop: 8,
    marginBottom: 8,
    alignSelf: 'center',
    border: '2px solid white',
    padding: '8px 16px',
    borderRadius: 4,
    fontSize: '11px',
    textAlign: 'center'
  }
}
styles.nextPopoverButton = { ...styles.basePopoverButton }
styles.quitPopoverButton = {
  ...styles.basePopoverButton,
  borderColor: 'rgba(255, 255, 255, 0.7)',
  color: 'rgba(255, 255, 255, 0.7)'
}

export default class SidelistControl extends React.Component {
  /* **************************************************************************/
  // Class
  /* **************************************************************************/

  static propTypes = {
    onClick: PropTypes.func.isRequired,
    icon: PropTypes.element.isRequired,
    iconStyle: PropTypes.object,
    tooltip: PropTypes.node.isRequired,
    tourStep: PropTypes.oneOf(Object.keys(Tour.TOUR_STEPS)).isRequired,
    tourTooltip: PropTypes.node.isRequired,
    tourTooltipStyles: PropTypes.shape({
      style: PropTypes.object.isRequired,
      arrowStyle: PropTypes.object.isRequired
    })
  }

  /* **************************************************************************/
  // Component lifecycle
  /* **************************************************************************/

  componentDidMount () {
    settingsStore.listen(this.settingsChanged)
    this.dismissingTourTO = null
  }

  componentWillUnmount () {
    settingsStore.unlisten(this.settingsChanged)
    clearTimeout(this.dismissingTourTO)
  }

  /* **************************************************************************/
  // Data lifecycle
  /* **************************************************************************/

  state = (() => {
    const settingsState = settingsStore.getState()
    return {
      generatedId: uuid.v4(),
      hovering: false,
      hasSeenTour: settingsState.hasSeenTour,
      currentTourStep: settingsState.tourStep,
      dismissingTour: false
    }
  })()

  settingsChanged = (settingsState) => {
    this.setState({
      hasSeenTour: settingsState.hasSeenTour,
      currentTourStep: settingsState.tourStep
    })
  }

  /* **************************************************************************/
  // UI Events
  /* **************************************************************************/

  /**
  * Dismisses a tour popover gracefully
  * @param progressionFn: a function to call when the popover is no longer active
  */
  dismissTourPopover = (progressionFn) => {
    this.setState({ dismissingTour: true })
    clearTimeout(this.dismissingTourTO)
    this.dismissingTourTO = setTimeout(() => {
      progressionFn()
      clearTimeout(this.dismissingTourTO)
      this.dismissingTourTO = setTimeout(() => {
        this.setState({ dismissingTour: false })
      }, 250)
    }, 250)
  }

  /**
  * Handles the user progressing the tour
  * @param evt: the event that fired
  */
  handleTourNext = (evt) => {
    this.dismissTourPopover(() => settingsActions.tourNext())
  }

  /**
  * Handles the user quitting the tour
  * @param evt: the event that fired
  */
  handleTourQuit = (evt) => {
    evt.preventDefault()
    evt.stopPropagation()
    this.dismissTourPopover(() => settingsActions.tourQuit())
  }

  /* **************************************************************************/
  // Rendering
  /* **************************************************************************/

  /**
  * Renders the tooltip content for the tour
  * @param tourTooltip: the tooltip content
  * @return jsx
  */
  renderTourTooltipContent (tourTooltip) {
    return (
      <div style={styles.popoverContentContainer} onClick={this.handleTourNext}>
        {tourTooltip}
        <div style={styles.popoverButtonContainer}>
          <div style={styles.quitPopoverButton} onClick={this.handleTourQuit}>
            Skip Tour
          </div>
          <div style={styles.nextPopoverButton}>
            Got it
          </div>
        </div>
      </div>
    )
  }

  render () {
    const {
      style,
      onClick,
      icon,
      iconStyle,
      tooltip,
      tourStep,
      tourTooltip,
      tourTooltipStyles,
      ...passProps
    } = this.props
    const {
      generatedId,
      hovering,
      hasSeenTour,
      currentTourStep,
      dismissingTour
    } = this.state
    const showTourPopover = !hasSeenTour && currentTourStep === tourStep && !dismissingTour

    return (
      <div
        {...passProps}
        style={{...styles.container, ...style}}
        onMouseEnter={() => this.setState({ hovering: true })}
        onMouseLeave={() => this.setState({ hovering: false })}
        id={`ReactComponent-Sidelist-Control-${generatedId}`}>
        <IconButton iconStyle={{...styles.icon, ...iconStyle}} onClick={onClick}>
          {icon}
        </IconButton>
        <ReactPortalTooltip
          active={hovering && !showTourPopover}
          tooltipTimeout={0}
          style={styles.popover}
          position='right'
          arrow='center'
          group={generatedId}
          parent={`#ReactComponent-Sidelist-Control-${generatedId}`}>
          {tooltip}
        </ReactPortalTooltip>
        {showTourPopover ? (
          <ReactPortalTooltip
            active
            tooltipTimeout={0}
            style={tourTooltipStyles ? {
              style: { ...styles.tourPopover.style, ...tourTooltipStyles.style },
              arrowStyle: { ...styles.tourPopover.arrowStyle, ...tourTooltipStyles.arrowStyle }
            } : styles.tourPopover}
            position='right'
            arrow='center'
            group={generatedId}
            parent={`#ReactComponent-Sidelist-Control-${generatedId}`}>
            {this.renderTourTooltipContent(tourTooltip)}
          </ReactPortalTooltip>
        ) : undefined}
      </div>
    )
  }
}
