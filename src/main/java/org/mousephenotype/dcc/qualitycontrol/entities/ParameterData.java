/*
 * Copyright 2012 Medical Research Council Harwell.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.mousephenotype.dcc.qualitycontrol.entities;

import java.io.Serializable;
import java.util.List;
import javax.persistence.Basic;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlRootElement;
import javax.xml.bind.annotation.XmlType;

/**
 *
 * @author Gagarine Yaikhom <g.yaikhom@har.mrc.ac.uk>
 */
@Entity
@XmlRootElement
// we use short names to make JSON data compact thus minimising memory footprint
@XmlType(propOrder = {"i", "e", "n", "p", "s", "t", "d", "u", "ii", "iv", "it", "iu", "im", "o", "q", "ur"})
public class ParameterData implements Serializable {

    private static final long serialVersionUID = 1L;
    @Id
    @Basic(optional = false)
    @NotNull
    private Integer parameterId;
    @Size(max = 255)
    private String stableid;
    @Size(max = 255)
    private String parameterName;
    private Integer procedureId;
    private Integer weight;
    private Integer graphType;
    @Size(max = 18)
    private String datatype;
    @Size(max = 255)
    private String unit;
    private Integer incrementId;
    @Size(max = 255)
    private String incrementValue;
    @Size(max = 255)
    private String incrementType;
    @Size(max = 255)
    private String incrementUnit;
    private Integer incrementMin;
    private List<String> options;
    private short stateId;
    private Long numUnresolved;
    private short usableQcBound;
    private Float qcMin;
    private Float qcMax;
    private short required;

    public ParameterData() {
    }

    @XmlElement(name = "d")
    public String getDatatype() {
        return datatype;
    }

    public void setDatatype(String datatype) {
        this.datatype = datatype;
    }

    @XmlElement(name = "ii")
    public Integer getIncrementId() {
        return incrementId;
    }

    public void setIncrementId(Integer incrementId) {
        this.incrementId = incrementId;
    }

    @XmlElement(name = "im")
    public Integer getIncrementMin() {
        return incrementMin;
    }

    public void setIncrementMin(Integer incrementMin) {
        this.incrementMin = incrementMin;
    }

    @XmlElement(name = "it")
    public String getIncrementType() {
        return incrementType;
    }

    public void setIncrementType(String incrementType) {
        this.incrementType = incrementType;
    }

    @XmlElement(name = "iu")
    public String getIncrementUnit() {
        return incrementUnit;
    }

    public void setIncrementUnit(String incrementUnit) {
        this.incrementUnit = incrementUnit;
    }

    @XmlElement(name = "iv")
    public String getIncrementValue() {
        return incrementValue;
    }

    public void setIncrementValue(String incrementValue) {
        this.incrementValue = incrementValue;
    }

    @XmlElement(name = "i")
    public Integer getParameterId() {
        return parameterId;
    }

    public void setParameterId(Integer parameterId) {
        this.parameterId = parameterId;
    }

    @XmlElement(name = "n")
    public String getParameterName() {
        return parameterName;
    }

    public void setParameterName(String parameterName) {
        this.parameterName = parameterName;
    }

    @XmlElement(name = "p")
    public Integer getProcedureId() {
        return procedureId;
    }

    public void setProcedureId(Integer procedureId) {
        this.procedureId = procedureId;
    }

    @XmlElement(name = "s")
    public Integer getWeight() {
        return weight;
    }

    public void setWeight(Integer weight) {
        this.weight = weight;
    }

    @XmlElement(name = "e")
    public String getStableid() {
        return stableid;
    }

    @XmlElement(name = "t")
    public Integer getGraphType() {
        return graphType;
    }

    public void setGraphType(Integer graphType) {
        this.graphType = graphType;
    }

    public void setStableid(String stableid) {
        this.stableid = stableid;
    }

    @XmlElement(name = "u")
    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    @XmlElement(name = "o")
    public List<String> getOptions() {
        return options;
    }

    public void setOptions(List<String> options) {
        this.options = options;
    }

    @XmlElement(name = "q")
    public short getStateId() {
        return stateId;
    }

    public void setStateId(short stateId) {
        this.stateId = stateId;
    }

    @XmlElement(name = "ur")
    public Long getNumUnresolved() {
        return numUnresolved;
    }

    public void setNumUnresolved(Long numUnresolved) {
        this.numUnresolved = numUnresolved;
    }

    @XmlElement(name = "qm")
    public Float getQcMin() {
        return qcMin;
    }

    public void setQcMin(Float qcMin) {
        this.qcMin = qcMin;
    }

    @XmlElement(name = "qM")
    public Float getQcMax() {
        return qcMax;
    }

    public void setQcMax(Float qcMax) {
        this.qcMax = qcMax;
    }

    @XmlElement(name = "qb")
    public short isUsableQcBound() {
        return usableQcBound;
    }

    public void setUsableQcBound(short usableQcBound) {
        this.usableQcBound = usableQcBound;
    }

    @XmlElement(name = "r")
    public short isRequired() {
        return required;
    }

    public void setRequired(short required) {
        this.required = required;
    }
}
