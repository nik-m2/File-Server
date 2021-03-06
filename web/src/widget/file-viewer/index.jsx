import React from 'react';

import './index.less'

import PropTypes from 'prop-types';

import ContentSpacer from "../content-spacer";
import ProgressBar from '../progress-bar';
import Button from '../button';

import { Link } from 'react-router-dom'

import {cls} from "../../util/"


//Props: data, fetch
class File extends React.Component {
    displayName: "File";

    constructor(props) {
        super(props);
        this.interval = null;
        this.state = {
            open: false
        };
    }

    openFile() {

    }

    toggleOpen(e) {
        var data = this.props.data;

        if (!this.state.open && this.props.root.state.selected == data) {
            this.props.root.setSelected(null);
        }

        if (data.snapshots == null) {
            this.props.root.fetchDirectory("./" + data.full_path, data);
        }

        this.setState({
            open: !this.state.open,
        });

        return false;
    }

    render() {

        var root = this.props.root;

        var file = this.props.data;
        var isDir = file.type == 1;
        var selected = root.state.selected != null && root.state.selected == file;

        if (isDir && file.snapshots == null && this.props.fileView) {
            root.fetchDirectory("./" + file.full_path, file);
        } 

        var children = [];
        if (file.snapshots != null) {
            for (var i = 0; i < file.snapshots.length; i++) {
                children.push(
                    <File
                        fileView={this.props.fileView}
                        isChild
                        root={root}
                        className={cls(this, "child", {open: this.state.open})}
                        key={i}
                        data={file.snapshots[i]}>
                    </File>
                )
            }
        }

        var contents = ""
        if (this.props.fileView) {//OS Style view

            if (this.props.isChild) {//Child is a file within the current directory

                return (
                    <div 
                        className={cls(this, "", {childView: true, selected: selected}) + " " + this.props.className}
                        onClick={() => root.setSelected(file)}>

                        <img className={cls(this, "fileIcon")} src="img/file_view.svg"/>
                        <div>{file.file_name}</div>

                    </div>
                );

            } else {//This is the currently open folder

                return (
                    <div className={cls(this) + " " + this.props.className}>
                        {children}
                    </div>
                );

            }

        } else {//List style view
            var _this = this;

            var arrow = "";
            if (isDir) {
                arrow = this.state.open ? "\u25bc" : "\u25b6";

            }

            var onClick, onDoubleClick;
            if (isDir && this.state.open) {
                onClick = function() {};
                onDoubleClick = onClick;
            } else {
                onClick = () => root.setSelected(file)
                onDoubleClick = (isDir ? _this.toggleOpen : _this.openFile).bind(_this);
            }

            return (
                <div className={cls(this, "", {selected: selected}) + " " + this.props.className}>

                    <div className={cls(this, "arrowColumn")}>
                        <span className={cls(this, "arrow")} onClick={this.toggleOpen.bind(this)}>{arrow}</span>
                    </div>

                    <div
                        className={cls(this, "nameColumn", {openDir: isDir && this.state.open})}
                        onClick={onClick}
                        onDoubleClick={onDoubleClick}>

                        {file.file_name}
                        {children}

                    </div>

                </div>
            );

        }
        
    }
}

//Props: path
export default class FileViewer extends React.Component {
    displayName: "FileViewer";

    constructor(props) {
        super(props);
        this.interval = null;
        this.state = {
            error: null,
            isLoaded: false,
            data: null,
            view: "tree",
            selected: null,
            lastSelected: null, //This will be used when switching to file view.
                //If selected is a file then it will open it's directory
                //If selected is a directory it will open it
                //If selected is null and lastSelected is a directory then it will be opened
        };
    }

    setSelected(file_data) {
        var lastSelected = file_data == null ? this.state.selected : file_data;
        this.setState({
            selected: file_data,
            lastSelected: lastSelected,
        });
    }

    //file_data is used to have easy access to the file within the data tree
    fetchDirectory(path, file_data=null, isRoot=false) {
        fetch("/api/directorycontents", {
            cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
            credentials: 'same-origin', // include, same-origin, *omit
            method: 'POST', // *GET, POST, PUT, DELETE, etc.
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({
                "path": path
            }),
            mode: 'cors', // no-cors, cors, *same-origin
            redirect: 'follow', // *manual, follow, error
            referrer: 'no-referrer', // *client, no-referrer
        })
        .then(res => res.json())
        .then(
            (result) => {

                if (result.error != null) {
                    alert("Error: " + result.error);
                    return;
                }

                //This 
                if (file_data != null) {
                    file_data.snapshots = result.snapshots;
                    result = this.state.data;
                }

                this.setState({
                    error: null,
                    isLoaded: true,
                    data: result,
                });
            },
            (error) => {
                this.setState({
                    isLoaded: true,
                    error
                });
            }
        )
    }

    //view: either "tree" or "file"
    setView(view) {
        this.setState({
            view: view
        });
    }

    componentDidMount() {
        this.fetchDirectory(this.props.path, null, true)
    }

    componentWillUnmount() {
    }

    render() {
        var _this = this;

        var contents = ""

        var fileView = this.state.view == "file";

        if (this.state.data != null) {
            contents = (
                <File 
                    fileView={fileView} 
                    root={this} 
                    data={this.state.data}> 
                </File>
            )
        }

        var path = "";
        if (fileView) {
            path = this.props.path;
        }

        return (
            <div className={cls(this)}>
                <div className={cls(this, "settingsBar")}>
                    <div className={cls(this, "path")}>
                        {path}
                    </div>
                    <div className={cls(this, "viewChoice")}>
                        <Button 
                            onClick={() => _this.setView("tree")}
                            className={cls(this, "viewButton")}
                            selected={!fileView}
                            nav>
                            <img className={cls(this, "icon")} src="img/tree_view.svg"/>
                        </Button>
                        <Button 
                            onClick={() => _this.setView("file")}
                            className={cls(this, "viewButton")}
                            selected={fileView}
                            nav>
                            <img className={cls(this, "icon")} src="img/file_view.svg"/>
                        </Button>
                    </div>
                    <div className={cls(this, "gradient")}/>
                </div>
                <ContentSpacer>
                    {contents}
                </ContentSpacer>
            </div>
        )
        
    }
}

File.propTypes = {
    className: PropTypes.string,
    data: PropTypes.object.isRequired,
    root: PropTypes.instanceOf(FileViewer).isRequired,
    fileView: PropTypes.bool,
    isChild: PropTypes.bool
}

File.defaultProps = {
    className: "",
    fileView: false,
    isChild: false,
}

FileViewer.propTypes = {
    className: PropTypes.string,
    path: PropTypes.string.isRequired
}

FileViewer.defaultProps = {
    className: ""
}