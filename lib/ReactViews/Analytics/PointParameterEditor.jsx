"use strict";

import React from "react";

import createReactClass from "create-react-class";

import PropTypes from "prop-types";

import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import defined from "terriajs-cesium/Source/Core/defined";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import knockout from "terriajs-cesium/Source/ThirdParty/knockout";

import MapInteractionMode from "../../Models/MapInteractionMode";
import ObserveModelMixin from "../ObserveModelMixin";

import Styles from "./parameter-editors.scss";

const PointParameterEditor = createReactClass({
  displayName: "PointParameterEditor",
  mixins: [ObserveModelMixin],

  propTypes: {
    previewed: PropTypes.object,
    parameter: PropTypes.object,
    viewState: PropTypes.object,
    parameterViewModel: PropTypes.object
  },

  inputOnChange(e) {
    const text = e.target.value;
    this.props.parameterViewModel.userValue = text;
    this.props.parameterViewModel.isValueValid = PointParameterEditor.setValueFromText(
      e,
      this.props.parameter
    );
  },

  inputOnBlur(e) {
    const isCurrentlyInvalid = !this.props.parameterViewModel.isValueValid;
    this.props.parameterViewModel.wasEverBlurredWhileInvalid =
      this.props.parameterViewModel.wasEverBlurredWhileInvalid ||
      isCurrentlyInvalid;
  },

  selectPointOnMap() {
    PointParameterEditor.selectOnMap(
      this.props.previewed.terria,
      this.props.viewState,
      this.props.parameter
    );
  },

  getDisplayValue() {
    // Show the user's value if they've done any editing.
    if (defined(this.props.parameterViewModel.userValue)) {
      return this.props.parameterViewModel.userValue;
    }

    // Show the parameter's value if there is one.
    return PointParameterEditor.getDisplayValue(this.props.parameter.value);
  },

  render() {
    const parameterViewModel = this.props.parameterViewModel;
    const showErrorMessage =
      !parameterViewModel.isValueValid &&
      parameterViewModel.wasEverBlurredWhileInvalid;
    const style = showErrorMessage ? Styles.fieldInvalid : Styles.field;

    return (
      <div>
        <If condition={showErrorMessage}>
          <div className={Styles.warningText}>
            Please enter valid coordinates (e.g. 131.0361, -25.3450).
          </div>
        </If>
        <input
          className={style}
          type="text"
          onChange={this.inputOnChange}
          onBlur={this.inputOnBlur}
          value={this.getDisplayValue()}
          placeholder="131.0361, -25.3450"
        />
        <button
          type="button"
          onClick={this.selectPointOnMap}
          className={Styles.btnSelector}
        >
          Select location
        </button>
      </div>
    );
  }
});

/**
 * Triggered when user types value directly into field.
 * @param {String} e Text that user has entered manually.
 * @param {FunctionParameter} parameter Parameter to set value on.
 * @returns {Boolean} True if the value was set successfully; false if the value could not be parsed.
 */
PointParameterEditor.setValueFromText = function(e, parameter) {
  const text = e.target.value;

  if (text.trim().length === 0 && !parameter.isRequired) {
    parameter.value = undefined;
    return true;
  }

  // parseFloat will ignore non-numeric characters at the end of the string.
  // e.g. "5asdf" will be parsed successfully as "5".
  // So we reject the text if there are any characters in it other than
  // 0-9, whitespace, plus, minus, comma, and period.
  // This isn't perfect - some strings may still parse even though they
  // don't make sense, like "0..9,1.2.3" - but it will at least eliminate
  // common errors like trying to specify degrees/minutes/seconds or
  // specifying W or E rather than using positive or negative numbers
  // for longitude.
  if (/[^\d\s\.,+-]/.test(text)) {
    return false;
  }

  const coordinates = text.split(",");
  if (coordinates.length === 2) {
    const longitude = parseFloat(coordinates[0]);
    const latitude = parseFloat(coordinates[1]);
    if (isNaN(longitude) || isNaN(latitude)) {
      return false;
    }
    parameter.value = Cartographic.fromDegrees(
      parseFloat(coordinates[0]),
      parseFloat(coordinates[1])
    );
    return true;
  } else {
    return false;
  }
};

/**
 * Given a value, return it in human readable form for display.
 * @param {Object} value Native format of parameter value.
 * @return {String} String for display
 */
PointParameterEditor.getDisplayValue = function(value) {
  const digits = 5;

  if (defined(value)) {
    return (
      CesiumMath.toDegrees(value.longitude).toFixed(digits) +
      "," +
      CesiumMath.toDegrees(value.latitude).toFixed(digits)
    );
  } else {
    return "";
  }
};

/**
 * Prompt user to select/draw on map in order to define parameter.
 * @param {Terria} terria Terria instance.
 * @param {Object} viewState ViewState.
 * @param {FunctionParameter} parameter Parameter.
 */
PointParameterEditor.selectOnMap = function(terria, viewState, parameter) {
  // Cancel any feature picking already in progress.
  terria.pickedFeatures = undefined;

  const pickPointMode = new MapInteractionMode({
    message: "Select a point by clicking on the map.",
    onCancel: function() {
      terria.mapInteractionModeStack.pop();
      viewState.openAddData();
    }
  });
  terria.mapInteractionModeStack.push(pickPointMode);

  knockout
    .getObservable(pickPointMode, "pickedFeatures")
    .subscribe(function(pickedFeatures) {
      if (defined(pickedFeatures.pickPosition)) {
        const value = Ellipsoid.WGS84.cartesianToCartographic(
          pickedFeatures.pickPosition
        );
        terria.mapInteractionModeStack.pop();
        parameter.value = value;
        viewState.openAddData();
      }
    });

  viewState.explorerPanelIsVisible = false;
};

module.exports = PointParameterEditor;
